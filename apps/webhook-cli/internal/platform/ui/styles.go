package ui

import "github.com/charmbracelet/lipgloss"

var (
	Bold  = lipgloss.NewStyle().Bold(true)
	Faint = lipgloss.NewStyle().Faint(true)

	Success = lipgloss.NewStyle().Foreground(lipgloss.Color("2"))
	Error   = lipgloss.NewStyle().Foreground(lipgloss.Color("1")).Bold(true)
	Warning = lipgloss.NewStyle().Foreground(lipgloss.Color("3"))
	Info    = lipgloss.NewStyle().Foreground(lipgloss.Color("4"))
	Muted   = lipgloss.NewStyle().Foreground(lipgloss.Color("8"))

	SuccessIcon = Success.Render("✓")
	ErrorIcon   = Error.Render("✗")
	WarningIcon = Warning.Render("!")
	InfoIcon    = Info.Render("ℹ")

	methodGet    = lipgloss.NewStyle().Foreground(lipgloss.Color("2")).Bold(true)
	methodPost   = lipgloss.NewStyle().Foreground(lipgloss.Color("4")).Bold(true)
	methodPut    = lipgloss.NewStyle().Foreground(lipgloss.Color("3")).Bold(true)
	methodPatch  = lipgloss.NewStyle().Foreground(lipgloss.Color("3")).Bold(true)
	methodDelete = lipgloss.NewStyle().Foreground(lipgloss.Color("1")).Bold(true)
	methodOther  = lipgloss.NewStyle().Foreground(lipgloss.Color("5")).Bold(true)

	status2xx = lipgloss.NewStyle().Foreground(lipgloss.Color("2"))
	status3xx = lipgloss.NewStyle().Foreground(lipgloss.Color("6"))
	status4xx = lipgloss.NewStyle().Foreground(lipgloss.Color("3"))
	status5xx = lipgloss.NewStyle().Foreground(lipgloss.Color("1"))

	TableHeader = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("4")).Padding(0, 1)
	TableCell   = lipgloss.NewStyle().Padding(0, 1)
)

func MethodStyle(method string) lipgloss.Style {
	switch method {
	case "GET":
		return methodGet
	case "POST":
		return methodPost
	case "PUT":
		return methodPut
	case "PATCH":
		return methodPatch
	case "DELETE":
		return methodDelete
	default:
		return methodOther
	}
}

func StatusCodeStyle(code int) lipgloss.Style {
	switch {
	case code >= 200 && code < 300:
		return status2xx
	case code >= 300 && code < 400:
		return status3xx
	case code >= 400 && code < 500:
		return status4xx
	case code >= 500:
		return status5xx
	default:
		return Muted
	}
}
