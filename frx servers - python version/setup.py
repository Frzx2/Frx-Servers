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
from kivy.clock import Clock
import re
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
        self.manager.current = "select_server_folder"

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


