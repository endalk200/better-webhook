package ui

import (
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/lipgloss/table"
)

func NewTable(headers []string, rows [][]string) string {
	t := table.New().
		Headers(headers...).
		BorderStyle(lipgloss.NewStyle().Foreground(lipgloss.Color("8"))).
		StyleFunc(func(row, col int) lipgloss.Style {
			if row == table.HeaderRow {
				return TableHeader
			}
			return TableCell
		})

	for _, row := range rows {
		t.Row(row...)
	}

	return t.Render()
}

func NewKeyValueTable(pairs [][]string) string {
	t := table.New().
		Border(lipgloss.HiddenBorder()).
		StyleFunc(func(row, col int) lipgloss.Style {
			if col == 0 {
				return lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Padding(0, 1, 0, 0)
			}
			return lipgloss.NewStyle().Padding(0, 0, 0, 0)
		})

	for _, pair := range pairs {
		t.Row(pair...)
	}

	return t.Render()
}
