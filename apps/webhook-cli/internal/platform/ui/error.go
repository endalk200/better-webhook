package ui

import "fmt"

func FormatError(err error) string {
	if err == nil {
		return Error.Render("Error:")
	}
	return fmt.Sprintf("%s %s", Error.Render("Error:"), err.Error())
}
