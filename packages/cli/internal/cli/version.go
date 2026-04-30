package cli

const defaultVersion = "2.0.0-beta.4"

var (
	version = defaultVersion
	commit  = "unknown"
	date    = "unknown"
	builtBy = "source"
)

type BuildInfo struct {
	Version string
	Commit  string
	Date    string
	BuiltBy string
}

func BuildInfoFromLinker() BuildInfo {
	return BuildInfo{
		Version: version,
		Commit:  commit,
		Date:    date,
		BuiltBy: builtBy,
	}
}
