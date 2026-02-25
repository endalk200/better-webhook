package ui

import "fmt"

func FormatError(err error) string {
	return fmt.Sprintf("%s %s", Error.Render("Error:"), err.Error())
}
