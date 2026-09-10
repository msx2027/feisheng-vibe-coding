#!/usr/bin/env python3
"""
shadcn/ui Component Installer

Add shadcn/ui components to a project with automatic dependency handling.
Runs only a locked project-local shadcn CLI; it never downloads a CLI fallback.
"""

import argparse
import json
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, Optional


class ShadcnInstaller:
    """Handle shadcn/ui component installation."""

    LOCK_FILE_NAMES = (
        "package-lock.json",
        "npm-shrinkwrap.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "bun.lock",
        "bun.lockb",
    )
    CLI_SETUP_HINT = (
        "Pin an approved exact 'shadcn' version in package.json, commit package.json "
        "and the package-manager lock file, then install dependencies from that lock "
        "file. This helper never downloads or falls back to a remote CLI."
    )

    def __init__(self, project_root: Optional[Path] = None, dry_run: bool = False):
        """
        Initialize installer.

        Args:
            project_root: Project root directory (default: current directory)
            dry_run: If True, show actions without executing
        """
        self.project_root = project_root or Path.cwd()
        self.dry_run = dry_run
        self.components_json = self.project_root / "components.json"

    def check_shadcn_config(self) -> bool:
        """
        Check if shadcn is initialized in project.

        Returns:
            True if components.json exists
        """
        return self.components_json.exists()

    def find_project_lock_file(self) -> Optional[Path]:
        """Return the first non-empty supported lock file owned by the project."""
        for name in self.LOCK_FILE_NAMES:
            candidate = self.project_root / name
            try:
                if candidate.is_file() and candidate.stat().st_size > 0:
                    return candidate
            except OSError:
                continue
        return None

    def resolve_local_cli(self) -> tuple[Optional[List[str]], str]:
        """Resolve the locked shadcn JS entry and a trusted Node executable."""
        lock_file = self.find_project_lock_file()
        if lock_file is None:
            return (
                None,
                f"No usable project lock file found. {self.CLI_SETUP_HINT}",
            )

        node_executable = shutil.which("node")
        if not node_executable:
            return (
                None,
                "Node.js executable not found in PATH. Restore the approved Node "
                f"toolchain and dependencies from '{lock_file.name}'. {self.CLI_SETUP_HINT}",
            )

        package_dir = self.project_root / "node_modules" / "shadcn"
        package_json = package_dir / "package.json"
        try:
            package_config = json.loads(package_json.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return (
                None,
                f"Locked project-local shadcn package metadata not found at '{package_json}'. "
                f"Restore dependencies from '{lock_file.name}'. {self.CLI_SETUP_HINT}",
            )

        if package_config.get("name") != "shadcn":
            return None, f"Unexpected package identity in '{package_json}'. {self.CLI_SETUP_HINT}"

        bin_config = package_config.get("bin")
        if isinstance(bin_config, str):
            bin_relative = bin_config
        elif isinstance(bin_config, dict) and isinstance(bin_config.get("shadcn"), str):
            bin_relative = bin_config["shadcn"]
        else:
            return None, f"Package '{package_json}' has no verified shadcn bin entry."

        package_root = package_dir.resolve()
        cli_entry = (package_dir / bin_relative).resolve()
        try:
            cli_entry.relative_to(package_root)
        except ValueError:
            return None, f"Rejected shadcn bin entry escaping its package directory: '{bin_relative}'."

        if not cli_entry.is_file():
            return (
                None,
                f"Locked project-local shadcn CLI JS entry not found at '{cli_entry}'. "
                f"Restore dependencies from '{lock_file.name}'. {self.CLI_SETUP_HINT}",
            )

        return [str(Path(node_executable).resolve()), str(cli_entry)], ""

    def run_local_cli(
        self, arguments: List[str], success_message: str
    ) -> tuple[bool, str]:
        """Run only the verified project-local CLI."""
        command_prefix, error = self.resolve_local_cli()
        if command_prefix is None:
            return False, error

        cmd = [*command_prefix, *arguments]
        if self.dry_run:
            return True, f"Would run: {shlex.join(cmd)}"

        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                check=True,
                shell=False,
            )

            if result.stdout:
                success_message += f"\n\nOutput:\n{result.stdout}"
            return True, success_message

        except subprocess.CalledProcessError as exc:
            details = exc.stderr or exc.stdout or str(exc)
            return False, f"Failed to add components: {details}"
        except OSError as exc:
            return (
                False,
                "The verified project-local shadcn CLI could not be executed: "
                f"{exc}. Restore dependencies from the committed lock file. "
                "This helper never downloads or falls back to a remote CLI.",
            )

    def get_installed_components(self) -> List[str]:
        """
        Get list of already installed components.

        Returns:
            List of installed component names
        """
        if not self.check_shadcn_config():
            return []

        try:
            with open(self.components_json, encoding="utf-8") as f:
                config = json.load(f)

            components_dir = self.project_root / config.get("aliases", {}).get(
                "components", "components"
            ).replace("@/", "")
            ui_dir = components_dir / "ui"

            if not ui_dir.exists():
                return []

            return [f.stem for f in ui_dir.glob("*.tsx") if f.is_file()]
        except (json.JSONDecodeError, KeyError, OSError):
            return []

    def add_components(
        self, components: List[str], overwrite: bool = False
    ) -> tuple[bool, str]:
        """
        Add shadcn/ui components.

        Args:
            components: List of component names to add
            overwrite: If True, overwrite existing components

        Returns:
            Tuple of (success, message)
        """
        if not components:
            return False, "No components specified"

        if not self.check_shadcn_config():
            return (
                False,
                "shadcn not initialized. Initialize it with the locked project-local "
                "CLI ('npm exec --offline -- shadcn init'; Windows PowerShell: "
                "'npm.cmd exec --offline -- shadcn init') after committing the "
                "package-manager lock file.",
            )

        # Check which components already exist
        installed = self.get_installed_components()
        already_installed = [c for c in components if c in installed]

        if already_installed and not overwrite:
            return (
                False,
                f"Components already installed: {', '.join(already_installed)}. "
                "Use --overwrite to reinstall",
            )

        arguments = ["add", *components]
        if overwrite:
            arguments.append("--overwrite")

        return self.run_local_cli(
            arguments,
            f"Successfully added components: {', '.join(components)}",
        )

    def add_all_components(self, overwrite: bool = False) -> tuple[bool, str]:
        """
        Add all available shadcn/ui components.

        Args:
            overwrite: If True, overwrite existing components

        Returns:
            Tuple of (success, message)
        """
        if not self.check_shadcn_config():
            return (
                False,
                "shadcn not initialized. Initialize it with the locked project-local "
                "CLI ('npm exec --offline -- shadcn init'; Windows PowerShell: "
                "'npm.cmd exec --offline -- shadcn init') after committing the "
                "package-manager lock file.",
            )

        arguments = ["add", "--all"]
        if overwrite:
            arguments.append("--overwrite")

        return self.run_local_cli(arguments, "Successfully added all components")

    def list_installed(self) -> tuple[bool, str]:
        """
        List installed components.

        Returns:
            Tuple of (success, message with component list)
        """
        if not self.check_shadcn_config():
            return False, "shadcn not initialized"

        installed = self.get_installed_components()

        if not installed:
            return True, "No components installed"

        return True, f"Installed components:\n" + "\n".join(f"  - {c}" for c in sorted(installed))


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Add shadcn/ui components to your project",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Add single component
  python shadcn_add.py button

  # Add multiple components
  python shadcn_add.py button card dialog

  # Add all components
  python shadcn_add.py --all

  # Overwrite existing components
  python shadcn_add.py button --overwrite

  # Dry run (show what would be done)
  python shadcn_add.py button card --dry-run

  # List installed components
  python shadcn_add.py --list
        """,
    )

    parser.add_argument(
        "components",
        nargs="*",
        help="Component names to add (e.g., button, card, dialog)",
    )

    parser.add_argument(
        "--all",
        action="store_true",
        help="Add all available components",
    )

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing components",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without executing",
    )

    parser.add_argument(
        "--list",
        action="store_true",
        help="List installed components",
    )

    parser.add_argument(
        "--project-root",
        type=Path,
        help="Project root directory (default: current directory)",
    )

    args = parser.parse_args()

    # Initialize installer
    installer = ShadcnInstaller(
        project_root=args.project_root,
        dry_run=args.dry_run,
    )

    # Handle list command
    if args.list:
        success, message = installer.list_installed()
        print(message)
        sys.exit(0 if success else 1)

    # Handle add all command
    if args.all:
        success, message = installer.add_all_components(overwrite=args.overwrite)
        print(message)
        sys.exit(0 if success else 1)

    # Handle add specific components
    if not args.components:
        parser.print_help()
        sys.exit(1)

    success, message = installer.add_components(
        args.components,
        overwrite=args.overwrite,
    )

    print(message)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
