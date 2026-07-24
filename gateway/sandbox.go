package main

import (
	"fmt"
	"time"

	"rogchap.com/v8go"
)

// ExecuteCode runs the user-provided JavaScript code inside a V8 isolate sandbox
func ExecuteCode(code string) (string, error) {
	iso := v8go.NewIsolate()
	defer iso.Dispose()

	ctx := v8go.NewContext(iso)
	defer ctx.Close()

	// Implement simple timeout channel
	errCh := make(chan error, 1)
	resCh := make(chan *v8go.Value, 1)

	go func() {
		val, err := ctx.RunScript(code, "script.js")
		if err != nil {
			errCh <- err
			return
		}
		resCh <- val
	}()

	select {
	case <-time.After(50 * time.Millisecond):
		iso.TerminateExecution()
		return "", fmt.Errorf("execution timed out")
	case err := <-errCh:
		return "", err
	case val := <-resCh:
		if val == nil || val.IsNull() || val.IsUndefined() {
			return "", nil
		}
		return val.String(), nil
	}
}
