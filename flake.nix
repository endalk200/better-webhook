{
  description = "better-webhook CLI flake";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };

  outputs = { self, flake-utils, nixpkgs }:
    flake-utils.lib.eachSystem [
      "aarch64-darwin"
      "x86_64-darwin"
      "aarch64-linux"
      "x86_64-linux"
    ] (system:
      let
        pkgs = import nixpkgs { inherit system; };
        bw = pkgs.buildGoModule {
          pname = "bw";
          version = "0.0.0-dev";
          go = pkgs.go_1_25;
          src = ./.;
          modRoot = "./apps/cli";
          subPackages = [ "." ];
          vendorHash = "sha256-9jK3jKbFp+5WSQfMbNzwIB55bC5KScZOaFHItffTF00=";
          env.CGO_ENABLED = 0;
          ldflags = [
            "-s"
            "-w"
            "-X github.com/endalk200/better-webhook/apps/cli/internal/version.Version=dev"
            "-X github.com/endalk200/better-webhook/apps/cli/internal/version.Commit=unknown"
            "-X github.com/endalk200/better-webhook/apps/cli/internal/version.Date=unknown"
          ];
          meta = with pkgs.lib; {
            description = "Better Webhook CLI";
            homepage = "https://github.com/endalk200/better-webhook";
            license = licenses.mit;
            mainProgram = "bw";
            platforms = platforms.darwin ++ platforms.linux;
          };
        };
      in {
        packages = {
          default = bw;
          bw = bw;
        };

        apps = {
          default = flake-utils.lib.mkApp { drv = bw; };
          bw = flake-utils.lib.mkApp { drv = bw; };
        };

        checks = {
          bw = bw;
        };
      });
}
