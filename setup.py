import os
import json
import shutil
import glob
import subprocess
import tkinter as tk
from tkinter import filedialog
from kivymd.uix.screen import MDScreen
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton
from kivymd.uix.filemanager import MDFileManager
from kivy.utils import platform
from kivy.metrics import dp
from kivymd.uix.screen import MDScreen
from kivymd.uix.button import MDRaisedButton
from kivymd.uix.label import MDLabel
from kivymd.uix.filemanager import MDFileManager
import os, shutil, glob, subprocess
CONFIG_PATH = "config.json"

# -------------------------------
# Utility functions for config
# -------------------------------
def load_config():
    """Load config from JSON file, return empty dict if missing or invalid."""
    if os.path.exists(CONFIG_PATH) and os.path.getsize(CONFIG_PATH) > 0:
        try:
            with open(CONFIG_PATH, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}

def save_config(config):
    """Save config dictionary to JSON file."""
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=4)

# -------------------------------
# Setup Screen
# -------------------------------
class Setup(MDScreen):
    def start_setup(self):
        """Move to Java detection screen."""
        self.manager.current = "java_detection"

# -------------------------------
# Java Detection Screen
# -------------------------------
from kivy.metrics import dp
from kivymd.uix.screen import MDScreen
from kivymd.uix.filemanager import MDFileManager
from kivymd.uix.card import MDCard
from kivymd.uix.button import MDRaisedButton
from kivymd.uix.label import MDLabel
import shutil
import glob
import os
import subprocess


class Java_detection(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.file_manager = MDFileManager(
            exit_manager=self.close_file_manager,
            select_path=self.select_java_file_path,
            preview=False
        )
        self.config = load_config()
        self.selected_java_path = None  # Only store the Java path the user picks

    def on_enter(self):
        """Display detected Java installations as cards with Add buttons."""
        container = self.ids.java_list
        container.clear_widgets()
        java_versions = self.get_java_versions()

        if java_versions:
            for v in java_versions:
                card = MDCard(
                    orientation="horizontal",
                    padding=10,
                    size_hint_y=None,
                    height=dp(50),
                    radius=[12, 12, 12, 12],
                    md_bg_color=(0.2, 0.2, 0.25, 1)
                )

                path_label = MDLabel(
                    text=v,
                    halign="left",
                    theme_text_color="Custom",
                    text_color=(1, 1, 1, 1)
                )

                add_btn = MDRaisedButton(
                    text="Add",
                    md_bg_color=(0.1, 0.6, 0.2, 1),
                    text_color=(1, 1, 1, 1),
                    size_hint_x=None,
                    width=dp(80),
                    on_release=lambda x, val=v: self.select_java(val)
                )

                card.add_widget(path_label)
                card.add_widget(add_btn)
                container.add_widget(card)
        else:
            container.add_widget(MDLabel(
                text="No Java detected. Please select manually.",
                halign="center",
                theme_text_color="Custom",
                text_color=(1, 1, 1, 1)
            ))

    # -------------------------------
    # Set the selected Java path
    # -------------------------------
    def select_java(self, path):
        self.selected_java_path = path
        self.ids.java_path_input.text = path
        self.ids.java_display_logo.text = f"Java path selected: {path}"

    # -------------------------------
    # File Manager to pick Java manually
    # -------------------------------
    def select_java_file(self):
        start_path = "/" if os.name != "nt" else r"C:\Program Files\Java"
        self.file_manager.show(start_path)

    def select_java_file_path(self, path):
        if path.lower().endswith("java") or path.lower().endswith("java.exe"):
            self.select_java(path)
        else:
            self.ids.java_display_logo.text = "Please select a valid Java executable"
        self.close_file_manager()

    def close_file_manager(self, *args):
        self.file_manager.close()

    # -------------------------------
    # Validate Java executable
    # -------------------------------
    def validate_java_path(self, path):
        if not path or not os.path.exists(path):
            return False
        try:
            result = subprocess.run([path, "-version"], capture_output=True, text=True)
            return result.returncode == 0 and "version" in (result.stderr + result.stdout).lower()
        except Exception:
            return False

    # -------------------------------
    # Save only the selected Java and move to next screen
    # -------------------------------
    def save_java_file(self):
        if not self.selected_java_path:
            self.ids.java_display_logo.text = "No Java Path Selected"
            return
        if not self.validate_java_path(self.selected_java_path):
            self.ids.java_display_logo.text = "Invalid Java Path"
            return

        # Save only the selected path
        config = load_config()
        config["java_path"] = self.selected_java_path
        save_config(config)
        self.ids.java_display_logo.text = f"Java path saved: {self.selected_java_path}"
        self.manager.current = "select_server_folder"

    # -------------------------------
    # Detect Java installations (for display only)
    # -------------------------------
    def get_java_versions(self):
        java_paths = []

        # From PATH
        java_in_path = shutil.which("java")
        if java_in_path:
            java_paths.append(java_in_path)

        # From JAVA_HOME
        java_home = os.environ.get("JAVA_HOME")
        if java_home:
            candidate = os.path.join(java_home, "bin", "java")
            if os.name == "nt":
                candidate += ".exe"
            if os.path.isfile(candidate):
                java_paths.append(candidate)

        # Common Windows locations
        if os.name == "nt":
            java_paths += glob.glob(r"C:\Program Files\Java\*\bin\java.exe")
            java_paths += glob.glob(r"C:\Program Files (x86)\Java\*\bin\java.exe")

        # Remove duplicates
        return list(dict.fromkeys(java_paths))


# -------------------------------
# Server Folder Screen
# -------------------------------
class Server_Folder(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.config = load_config()

    def folder_picker(self):
        """Open a folder selection dialog (cross-platform)."""
        try:
            root = tk.Tk()
            root.withdraw()
            initial_dir = "/" if os.name != "nt" else "C:\\"
            file_path = filedialog.askdirectory(title="Select Server Folder", initialdir=initial_dir)
            root.destroy()
            if file_path:
                self.ids.folder_path.text = file_path
                self.ids.status_label.text = ""
        except Exception as e:
            # For headless Linux (Raspberry Pi), consider zenity fallback
            self.ids.status_label.text = f"Failed to open folder picker: {str(e)}"

    def validate_dir(self, path):
        """Validate selected folder and save to config."""
        if os.path.isdir(path):
            config = load_config()
            config["server_location"] = path
            save_config(config)
            self.complete_setup()
        else:
            self.ids.status_label.text = "Invalid Folder Location"

    def complete_setup(self):
        """Finalize setup and mark it as complete."""
        config = load_config()
        config["setup"] = True
        save_config(config)
        self.manager.current = "homescreen"
