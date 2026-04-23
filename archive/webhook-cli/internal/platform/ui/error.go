package ui

func FormatError(err error) string {
	if err == nil {
		return Error.Render("Error:")
	}
	return Error.Render("Error:") + " " + SanitizeForTerminal(err.Error())
}
