const express = require('express');
const ivm = require('isolated-vm');
const app = express();

app.use(express.json());

app.post('/execute', async (req, res) => {
    try {
        const { code, method, url, headers, body } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        const isolate = new ivm.Isolate({ memoryLimit: 128 });
        const context = await isolate.createContext();
        const jail = context.global;

        await jail.set('global', jail.derefInto());

        // Basic logging
        await jail.set('log', function(...args) {
            console.log(...args);
        });

        // Basic fetch plugin
        await context.evalClosure(`
            global.fetch = async function(url, options) {
                return $0.apply(undefined, [url, options], { arguments: { copy: true }, result: { promise: true, copy: true } });
            }
        `, [
            async (fetchUrl, options) => {
                const fetch = (await import('node-fetch')).default;
                const response = await fetch(fetchUrl, options);
                const text = await response.text();
                return {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Array.from(response.headers.entries()),
                    body: text
                };
            }
        ]);

        const script = await isolate.compileScript(`
            (async () => {
                const request = ${JSON.stringify({ method, url, headers, body })};
                ${code}
            })()
        `);

        const result = await script.run(context, { promise: true, timeout: 5000 });

        res.json({ result });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Sandbox listening on port ${PORT}`));
