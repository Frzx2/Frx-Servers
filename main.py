from docutils.nodes import status
from kivy.app import App
from kivy.uix.button import Button
import os
from kivy.uix.screenmanager import ScreenManager, Screen, FadeTransition, SwapTransition, SlideTransition, \
    WipeTransition
from kivy.core.window import Window
import json
from mcrcon import MCRcon
import hashlib
import re
from kivy.properties import ObjectProperty
from kivy.uix.behaviors import FocusBehavior, ButtonBehavior
from mcstatus import MCServer
from kivy.uix.recycleview.views import RecycleDataViewBehavior
from kivy.uix.recycleboxlayout import RecycleBoxLayout
import os
import shutil
import webbrowser

from kivy.properties import StringProperty, ListProperty, BooleanProperty
from kivy.core.window import Window
from kivymd.uix.screen import MDScreen
from kivymd.uix.list import OneLineAvatarIconListItem, IconLeftWidget
from kivymd.uix.dialog import MDDialog
from kivymd.uix.button import MDFlatButton, MDRaisedButton
from kivymd.uix.textfield import MDTextField
from kivy.uix.textinput import TextInput
from ctypes import windll, create_unicode_buffer
import shutil
from kivy.uix.popup import Popup
from pathlib import Path
from kivy.uix.recycleview.views import RecycleDataViewBehavior
from functools import partial
from ctypes import windll, create_unicode_buffer
from kivy.core.window import Window
from kivy.properties import ObjectProperty, StringProperty, ListProperty, BooleanProperty
from functools import partial
from kivymd.uix.snackbar import Snackbar
from kivymd.uix.menu import MDDropdownMenu
from kivymd.uix.selectioncontrol import MDCheckbox
from kivy.metrics import dp
from kivymd.uix.label import MDLabel
import random
from kivymd.uix.scrollview import MDScrollView
import secrets
from kivy.uix.image import AsyncImage
from threading import  Thread
from kivy.uix.widget import Widget
from kivy.graphics import Color, Ellipse, Rectangle
import configparser
from kivy.utils import platform
import psutil
from kivymd.uix.dialog import MDDialog
import base64
from kivy.clock import Clock
from kivy.uix.boxlayout import BoxLayout
from kivy.core.clipboard import Clipboard
from kivymd.app import MDApp
from kivymd.uix.label import MDLabel
from kivy_garden.graph import Graph, MeshLinePlot
from kivymd.uix.screen import MDScreen
from kivymd.uix.button import MDRaisedButton,MDFlatButton
from kivymd.uix.boxlayout import MDBoxLayout
import time
import threading
from kivy.uix.screenmanager import ScreenManager, NoTransition
from setup import Setup
from kivy.uix.scrollview import ScrollView
from kivy.lang import  Builder
from kivymd.uix.fitimage import FitImage
from kivymd.uix.filemanager import MDFileManager
import requests
from io import BytesIO
from setup import  Java_detection
from setup import Server_Folder
from kivymd.uix.card import MDCard
import shutil
import requests
from kivymd.uix.list import OneLineListItem
from threading import Thread
from kivy.clock import mainthread
from kivymd.uix.spinner import MDSpinner
import tkinter as tk
from tkinter import filedialog
import subprocess
from kivy.uix.label import Label
from kivy.properties import NumericProperty
from mcstatus import JavaServer
import datetime


import os, json
from kivy.clock import Clock
from kivymd.uix.screen import MDScreen
from kivymd.uix.card import MDCard
from kivymd.toast import toast
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton
from kivy.uix.filechooser import FileChooserListView


from kivy.clock import Clock
from kivymd.uix.screen import MDScreen
from kivymd.uix.button import MDRaisedButton
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.card import MDCard
from kivymd.uix.label import MDLabel
import os
import json
import threading
import time

CONFIG_PATH = "config.json"
UPDATE_INTERVAL = 5  # seconds; configurable interval for status updates

class Home_Screen(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.server_cache = {}  # Cache for server_info.json contents
        self.server_mtimes = {}  # Track last modified times
        self.updater = None
        self.load_thread = None

    def on_pre_enter(self):
        """Start updating servers whenever this screen is entered"""
        # Load servers directly on the main thread (no background thread)
        self.load_servers()

        # Start live updater at configurable interval
        if not self.updater:
            self.updater = Clock.schedule_interval(self.update_server_status, UPDATE_INTERVAL)

    def on_leave(self):
        """Stop updater when leaving the screen"""
        if self.updater:
            self.updater.cancel()
            self.updater = None

    def load_servers(self):
        """Load all Minecraft servers and create cards (runs on main thread)"""
        container = self.ids.server_container
        container.clear_widgets()  # clear old servers

        # Load config
        if not os.path.exists(CONFIG_PATH):
            self._add_no_server_label(container)
            return

        try:
            with open(CONFIG_PATH, "r") as f:
                config = json.load(f)
        except json.JSONDecodeError:
            self._add_no_server_label(container)
            return

        server_location = config.get("server_location", "")
        if not server_location or not os.path.exists(server_location):
            self._add_no_server_label(container)
            return

        added = False
        for folder in os.listdir(server_location):
            folder_path = os.path.join(server_location, folder)
            if os.path.isdir(folder_path):
                eula = os.path.join(folder_path, "eula.txt")
                props = os.path.join(folder_path, "server.properties")
                server_info = os.path.join(folder_path, "server_info.json")
                if os.path.exists(eula) and os.path.exists(props) and os.path.exists(server_info):
                    # Skip if already exists
                    if any(getattr(c, "server_path", None) == folder_path for c in container.children):
                        continue
                    # Add card directly (no lambda needed)
                    self.add_server_card(folder, folder_path)
                    added = True

        if not added:
            self._add_no_server_label(container)

    def _add_no_server_label(self, container):
        """Add placeholder label when no server exists"""
        container.add_widget(MDLabel(
            text="No server found. Create a server",
            halign="center",
            font_style="H6",
            theme_text_color="Custom",
            text_color=(1, 1, 1, 1)
        ))

    def add_server_card(self, server_name, path):
        """Create a server card UI with cached server info"""
        card = MDCard(
            orientation="vertical",
            size_hint_y=None,
            height="160dp",
            padding="12dp",
            radius=[20],
            style="outlined",
            md_bg_color=(0.15, 0.15, 0.15, 1),
            line_color=(0.25, 0.6, 1, 0.3),
            elevation=6
        )
        card.server_name = server_name
        card.server_path = path

        # Top row: server name + status
        top = MDBoxLayout(orientation="horizontal", spacing="10dp", size_hint_y=None, height="40dp")
        name_lbl = MDLabel(text=server_name, theme_text_color="Custom", text_color=(1,1,1,1), font_style="H6")
        status_lbl = MDLabel(text="Status: Offline", theme_text_color="Custom", text_color=(0.8,0.8,0.8,1))
        card.name_lbl = name_lbl
        card.status_lbl = status_lbl
        top.add_widget(name_lbl)
        top.add_widget(status_lbl)

        # Middle rows: players & TPS
        players_lbl = MDLabel(text="Players: 0/0", theme_text_color="Custom", text_color=(0.7,0.9,1,1))
        tps_lbl = MDLabel(text="TPS: N/A", theme_text_color="Custom", text_color=(0.9,0.8,0.6,1))
        card.players_lbl = players_lbl
        card.tps_lbl = tps_lbl

        # Bottom row: buttons
        bottom = MDBoxLayout(orientation="horizontal", spacing="10dp", size_hint_y=None, height="48dp")
        open_btn = MDRaisedButton(
            text="Open",
            md_bg_color=(0.2,0.6,0.9,1),
            text_color=(1,1,1,1),
            on_release=lambda x: self.open_server(server_name, path)
        )
        bottom.add_widget(open_btn)

        # Assemble card
        card.add_widget(top)
        card.add_widget(players_lbl)
        card.add_widget(tps_lbl)
        card.add_widget(bottom)

        self.ids.server_container.add_widget(card)

        # Initialize cache for this server
        server_info_path = os.path.join(path, "server_info.json")
        self._update_cache(server_info_path)

    def _update_cache(self, server_info_path):
        """Load server_info.json into memory and track modification time"""
        try:
            mtime = os.path.getmtime(server_info_path)
            if server_info_path not in self.server_mtimes or self.server_mtimes[server_info_path] < mtime:
                with open(server_info_path, "r") as f:
                    self.server_cache[server_info_path] = json.load(f)
                self.server_mtimes[server_info_path] = mtime
        except Exception as e:
            print(f"Error reading {server_info_path}: {e}")

    def update_server_status(self, dt):
        """Update player count, TPS, and status labels for each server"""
        if self.manager.current != "homescreen":
            return

        for card in self.ids.server_container.children:
            if hasattr(card, "server_path"):
                server_info_path = os.path.join(card.server_path, "server_info.json")
                # Only reload if file changed
                self._update_cache(server_info_path)
                data = self.server_cache.get(server_info_path, {})
                card.players_lbl.text = f"Players: {data.get('server_players','0/0')}"
                card.tps_lbl.text = f"TPS: {data.get('server_tps','N/A')}"
                card.status_lbl.text = f"Status: {data.get('server_status','Offline')}"

    def open_server(self, server_name, path):
        """Navigate to server status screen"""
        server_screen = self.manager.get_screen("status")
        server_screen.load_server(path=path, server_name=server_name)
        self.manager.current = "status"

    def toggle_server(self, server_name, path, status_lbl):
        """Start/Stop server (placeholder)"""
        if "Offline" in status_lbl.text:
            status_lbl.text = "Status: Online"
            print(f"Starting server: {server_name}")
        else:
            status_lbl.text = "Status: Offline"
            print(f"Stopping server: {server_name}")

    def filter_servers(self, search_text):
        """Filter servers by search query"""
        search_text = search_text.lower()
        container = self.ids.server_container

        matches, non_matches = [], []
        for card in list(container.children):
            if isinstance(card, MDCard) and hasattr(card, "name_lbl"):
                if search_text in card.name_lbl.text.lower():
                    matches.append(card)
                    card.opacity = 1
                    card.disabled = False
                else:
                    non_matches.append(card)
                    card.opacity = 0.5
                    card.disabled = True

        # Clear and add matches first, then non-matches
        container.clear_widgets()
        for card in matches + non_matches:
            container.add_widget(card)

    def create_server(self):
        """Navigate to server creation screen"""
        self.manager.current = "select_server_type"

    def configuration(self):
        """Navigate to configuration screen"""
        self.manager.current = "config"



class Server_Type(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.server_type = None  # Store user selection
        kv_dir = "design_files"
        Builder.load_file(os.path.join(kv_dir, "server_versions.kv"))
        Builder.load_file(os.path.join(kv_dir, "server_name_and_ram.kv"))
        Builder.load_file(os.path.join(kv_dir,"finalize_server.kv"))
        Builder.load_file(os.path.join(kv_dir, "finish_server.kv"))
    def pre_load(self):
        pass

    def select_type(self, type_name):
        """Called when user selects a server type"""
        self.server_type = type_name
        self.ids.selected_label.text = f"Selected: {type_name}"
        self.ids.next_btn.disabled = False  # Enable Next button
        app = MDApp.get_running_app()
        app.server_data["server_type"] = type_name

    def go_to_next(self):
        """Proceed to Server Version screen"""
        if self.server_type:
            # Store choice in the app dictionary
            app = MDApp.get_running_app()
            if not hasattr(app, "new_server_data"):
                app.new_server_data = {}
            app.new_server_data["server_type"] = self.server_type

            # Switch to Server_Version screen
            self.manager.current = "select_server_version"
    def back(self):
        self.manager.current = "homescreen"
class Server_Version(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.versions = []
        self.selected_version = None

    def on_pre_enter(self, *args):
        """Show spinner and fetch versions in background"""
        self.show_spinner()
        Thread(target=self.load_versions).start()

    def show_spinner(self):
        """Add a spinner while loading"""
        if not hasattr(self, "spinner"):
            self.spinner = MDSpinner(size_hint=(None, None), size=("48dp", "48dp"),
                                     pos_hint={"center_x": 0.5, "center_y": 0.5})
            self.add_widget(self.spinner)
        elif self.spinner.parent is None:
            # spinner was removed, add it back
            self.add_widget(self.spinner)
        self.spinner.active = True


    @mainthread
    def hide_spinner(self):
        """Hide spinner once loading done"""
        if hasattr(self, "spinner"):
            self.spinner.active = False
            self.remove_widget(self.spinner)


    def load_versions(self):

        """Clear thing in list"""
        container = self.ids.version_list
        container.clear_widgets()
        """Fetch versions in background thread"""
        app = MDApp.get_running_app()
        server_type = app.new_server_data.get("server_type", "Vanilla")

        try:
            if server_type.lower() == "vanilla":
                url = "https://launchermeta.mojang.com/mc/game/version_manifest.json"
                data = requests.get(url).json()
                self.versions = [v["id"] for v in data["versions"] if v["type"] == "release"]

            elif server_type.lower() == "paper":
                url = "https://api.papermc.io/v2/projects/paper"
                data = requests.get(url).json()
                self.versions = list(reversed(data["versions"]))

            elif server_type.lower() == "fabric":
                url = "https://meta.fabricmc.net/v2/versions/game"
                data = requests.get(url).json()

                # Each item has 'version' key (optional, or it's just a list of strings)
                self.versions = [v["version"] if isinstance(v, dict) else v for v in data if v.get("stable", False)]

            elif server_type.lower() == "forge":
                url = "https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json"
                data = requests.get(url).json()
                promos = data.get("promos", {})

                # Extract Minecraft versions from recommended keys
                versions = [key.replace("-recommended", "") for key in promos if "recommended" in key]

                # Assign to your class variable
                self.versions = list(reversed(versions))
        except Exception as e:
            print("Failed to fetch versions:", e)
            self.versions = []

        # Update UI on main thread
        self.populate_versions()


    @mainthread
    def populate_versions(self):
        """Create widgets once"""
        container = self.ids.version_list
        container.clear_widgets()
        self.version_widgets = []
        self.hide_spinner()

        for v in self.versions:
            widget = OneLineListItem(
                text=v,
                theme_text_color="Custom",
                text_color=(1, 1, 1, 1),  # white text
                on_release=lambda x=v: self.select_version(x)
            )
            self.version_widgets.append(widget)
            container.add_widget(widget)


    def filter_versions(self, search_text):
        """Show only matching widgets and move them to top"""
        search_text = search_text.lower()
        container = self.ids.version_list
        container.clear_widgets()

        # Filter widgets (keep original widgets, no new creation)
        filtered_widgets = [w for w in self.version_widgets if search_text in w.text.lower()]

        if not filtered_widgets:
            filtered_widgets = self.version_widgets  # show all if nothing matches

        # Add filtered widgets back to container in order
        for w in filtered_widgets:
            container.add_widget(w)

        # Scroll to top so first match is visible
        scroll_view = container.parent
        scroll_view.scroll_y = 1

    def select_version(self,x):
        selected = x.text
        self.ids.selected_version_label.text = f"{selected}  is the selected version"
        self.ids.next_btn.disabled = False
        app = MDApp.get_running_app()
        app.server_data["version"] = selected

    def back(self):
        self.ids.selected_version_label.text = " "
        self.ids.next_btn.disabled = True
        self.manager.current = "select_server_type"
        container = self.ids.version_list
        container.clear_widgets()
    def go_to_next(self):
        self.manager.current = "name_and_ram"
class Server_name_and_ram(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        mem = psutil.virtual_memory()
        total_mb = int(mem.total / (1024 ** 2))
        # make available RAM accessible to kv
        App.get_running_app().max_ram = total_mb

    def on_pre_enter(self, *args):
        self.ids.server_name.text=""
    def save_server_data(self, server_name, ram):
        if not server_name.strip():
            self.ids.error_label.text = "Error: Server name cannot be empty."
            return

        if ram < 2048:
            self.ids.error_label.text = "Error: RAM must be at least 2048 MB (2GB)."
            return

        if ram > App.get_running_app().max_ram:  # fixed line
            self.ids.error_label.text = f"Error: RAM cannot exceed {App.get_running_app().max_ram} MB."
            return

        # Save valid data into app dict
        app = MDApp.get_running_app()
        app.server_data["server_name"] = server_name.strip()
        app.server_data["ram"] = ram

        self.ids.error_label.text = f"Success: Server '{server_name}' saved with {ram} MB RAM!"
        self.manager.current = "customization"
    def back(self):
        self.manager.current = "select_server_version"
class Server_customization(MDScreen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.world_folder = None

    def pick_world_folder(self):
        """Open native OS file explorer to pick a Minecraft world folder (must contain level.dat)."""

        def open_dialog(*_):
            Window.unbind(on_draw=open_dialog)  # prevent loop

            root = tk.Tk()
            root.withdraw()
            folder = filedialog.askdirectory(
                title="Select Minecraft World Folder",
                initialdir=os.path.expanduser("~")
            )
            root.destroy()

            if folder:
                self.validate_folder(folder)
            else:
                self.ids.selected_folder_label.text = "No folder selected"
                self.world_folder = None

        Window.bind(on_draw=open_dialog)

    @mainthread
    def validate_folder(self, folder):
        """Check if folder contains level.dat (valid Minecraft world)."""
        level_dat = os.path.join(folder, "level.dat")
        if os.path.exists(level_dat):
            self.world_folder = folder
            self.ids.selected_folder_label.text = f"Selected: {self.world_folder}"
            toast("✅ Valid world folder selected")
        else:
            self.world_folder = None
            self.ids.selected_folder_label.text = "Invalid world folder!"
            toast("❌ This folder is not a valid Minecraft world")

    def clear_folder_selection(self):
        """Unselect any chosen folder."""
        self.world_folder = None
        self.ids.selected_folder_label.text = "No world folder selected"
        toast("📂 Folder selection cleared")

    def save_customization(self):
        """Save custom seed and/or world folder into app.server_data."""
        app = MDApp.get_running_app()
        seed = self.ids.seed_input.text.strip()

        if seed.isdigit():
            app.server_data["world_seed"] = int(seed)
        elif seed:
            app.server_data["world_seed"] = seed

        if self.world_folder:
            if os.path.exists(os.path.join(self.world_folder, "level.dat")):
                app.server_data["world_folder"] = self.world_folder
            else:
                self.ids.selected_folder_label.text = "Invalid world folder!"
                return

        self.manager.current = "finalize"

    def back(self):
        self.manager.current = "name_and_ram"
class Finalize_Server(MDScreen):

    def on_pre_enter(self, *args):
        app = App.get_running_app()
        name = app.server_data["server_name"] # server name
        ram = str(app.server_data["ram"])
        version = app.server_data["version"]
        server_type = app.server_data["server_type"]
        self.ids.server_type.text = f"Server Type: {server_type}"
        self.ids.server_ram.text = f"Selected Ram:{ram}"
        self.ids.server_name.text = f"Server Name: {name}"
        self.ids.server_version.text = f"Version: {version}"

    def finalize(self):
        if self.ids.eula_checkbox.active:
            self.ids.server_type.text = f""
            self.ids.server_ram.text = f""
            self.ids.server_name.text = f""
            self.ids.server_version.text = f""
            self.manager.current = "finish"
        else:
            self.ids.error_label.text = "You must accept the EULA "
class Finish_Server(MDScreen):
    """
    A screen class responsible for downloading, installing, and configuring
    a Minecraft server based on user selections.
    """

    def toggle_spinner(self, state: bool):
        """Toggles the loading spinner animation."""
        self.ids.server_spinner.active = state

    def finish(self):
        """Entry point when the user clicks the 'Finish' button."""
        # Disable buttons to prevent multiple clicks and start the process
        self.ids.next_btn.disabled = True
        self.ids.start.disabled = True
        self.ids.ready.text = "Getting the Server Ready For You..."
        self.toggle_spinner(state=True)
        # Run the download and setup process in a separate thread to keep the UI responsive
        Thread(target=self._finish_thread, daemon=True).start()

    def _finish_thread(self):
        """
        Handles ONLY the downloading of the required server files from the internet.
        Setup is delegated to the setup_server method after a successful download.
        """
        app = MDApp.get_running_app()
        data = app.server_data

        server_name = data.get("server_name")
        version = data.get("version")
        server_type = data.get("server_type")

        def update_label(msg):
            # Schedules the UI update on the main Kivy thread
            Clock.schedule_once(lambda dt: setattr(self.ids.error_label, "text", msg))
            print(msg)  # Also print to console for debugging

        if not all([server_name, version, server_type]):
            update_label("Error: Missing server information.")
            self.toggle_spinner(state=False)
            return

        try:
            # ---- Step 1: Load config and create server folder ----
            with open("config.json", "r") as f:
                config = json.load(f)
            base_location = config.get("server_location", os.getcwd())
            server_folder = os.path.join(base_location, server_name)
            os.makedirs(server_folder, exist_ok=True)
            update_label(f"Server directory created at: {server_folder}")

            # ---- Step 2: Download the appropriate server file ----
            server_type_lower = server_type.lower()

            if server_type_lower == "vanilla":
                update_label(f"Downloading Vanilla {version} server...")
                manifest_url = "https://launchermeta.mojang.com/mc/game/version_manifest.json"
                manifest = requests.get(manifest_url).json()
                version_info = next((v for v in manifest["versions"] if v["id"] == version), None)
                if not version_info:
                    update_label(f"Version {version} not found.")
                    return
                version_json = requests.get(version_info["url"]).json()
                server_url = version_json["downloads"]["server"]["url"]
                jar_path = os.path.join(server_folder, "server.jar")
                response = requests.get(server_url)
                response.raise_for_status()
                with open(jar_path, "wb") as f:
                    f.write(response.content)

            elif server_type_lower == "paper":
                update_label(f"Downloading Paper {version} server...")
                api_url = f"https://api.papermc.io/v2/projects/paper/versions/{version}"
                builds = requests.get(api_url).json().get("builds")
                if not builds:
                    update_label(f"No builds found for Paper {version}.")
                    return
                latest_build = max(builds)
                paper_url = f"https://api.papermc.io/v2/projects/paper/versions/{version}/builds/{latest_build}/downloads/paper-{version}-{latest_build}.jar"
                jar_path = os.path.join(server_folder, "server.jar")
                response = requests.get(paper_url)
                response.raise_for_status()
                with open(jar_path, "wb") as f:
                    f.write(response.content)

            elif server_type_lower == "fabric":
                update_label(f"Downloading Fabric {version} server...")
                # Note: Fabric loader versions might need to be updated or made selectable in the future.
                fabric_url = f"https://meta.fabricmc.net/v2/versions/loader/{version}/0.15.7/1.0.0/server/jar"
                jar_path = os.path.join(server_folder, "server.jar")
                response = requests.get(fabric_url)
                response.raise_for_status()
                with open(jar_path, "wb") as f:
                    f.write(response.content)

            elif server_type_lower == "forge":
                update_label("Finding recommended Forge version...")
                promos_url = "https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json"
                promos = requests.get(promos_url).json()
                forge_version = promos["promos"].get(f"{version}-recommended")
                if not forge_version:
                    update_label(f"No recommended Forge version found for Minecraft {version}.")
                    return

                update_label(f"Downloading Forge {forge_version} installer...")
                installer_name = f"forge-{version}-{forge_version}-installer.jar"
                installer_url = f"https://maven.minecraftforge.net/net/minecraftforge/forge/{version}-{forge_version}/{installer_name}"
                installer_path = os.path.join(server_folder, installer_name)
                response = requests.get(installer_url)
                response.raise_for_status()
                with open(installer_path, "wb") as f:
                    f.write(response.content)
                update_label("Forge installer downloaded successfully.")

            else:
                update_label(f"Unknown server type: {server_type}")
                return

            # ---- Step 3: Hand off to the setup method ----
            update_label("Download complete. Starting server setup...")
            self.setup_server()

        except requests.exceptions.RequestException as e:
            update_label(f"Download failed: {e}")
            self.toggle_spinner(state=False)
        except Exception as e:
            update_label(f"An error occurred: {e}")
            self.toggle_spinner(state=False)

    def setup_server(self):
        """
        Handles all post-download tasks: installing, configuring,
        and running the server for the first time to generate necessary files.
        """
        app = MDApp.get_running_app()
        data = app.server_data
        server_name = data.get("server_name")
        server_type = data.get("server_type", "").lower()
        version = data.get("version")
        server_ram = data.get("ram", 2048)
        world_seed = data.get("world_seed")
        custom_world = data.get("world_folder")

        def update_label(msg):
            Clock.schedule_once(lambda dt: setattr(self.ids.error_label, "text", msg))
            print(msg)

        try:
            # ---- Load base location ----
            with open("config.json", "r") as f:
                config = json.load(f)
            base_location = config.get("server_location", os.getcwd())
            server_folder = os.path.join(base_location, server_name)

            # ---- Handle custom world BEFORE first run ----
            if custom_world and os.path.isdir(custom_world):
                target_world = os.path.join(server_folder, "world")
                update_label("Copying custom world...")
                if os.path.exists(target_world):
                    shutil.rmtree(target_world)
                shutil.copytree(custom_world, target_world)
                update_label("Custom world copied successfully.")

            # ---- Apply world seed AFTER first run ----
            def apply_seed():
                if world_seed:
                    props_path = os.path.join(server_folder, "server.properties")
                    if os.path.exists(props_path):
                        with open(props_path, "a") as f:
                            f.write(f"\nlevel-seed={world_seed}\n")
                        update_label(f"Applied custom seed: {world_seed}")

            # ==================================================
            # ---------------- Forge Setup ---------------------
            # ==================================================
            if server_type == "forge":
                update_label("DEBUG: Forge setup started")

                installer_path = next(
                    (os.path.join(server_folder, f) for f in os.listdir(server_folder) if "installer.jar" in f),
                    None
                )
                if not installer_path:
                    update_label("DEBUG: Forge installer not found!")
                    return

                subprocess.run(["java", "-jar", installer_path, "--installServer"], cwd=server_folder, check=True)
                update_label("DEBUG: Forge installer finished")

                forge_shim_jar = next(
                    (os.path.join(server_folder, f) for f in os.listdir(server_folder) if f.endswith("-shim.jar")),
                    None
                )
                if not forge_shim_jar:
                    update_label("DEBUG: Forge shim jar not found after install!")
                    return

                jar_path = os.path.join(server_folder, "server.jar")
                shutil.copy2(forge_shim_jar, jar_path)
                update_label(f"DEBUG: Forge shim jar copied to {jar_path}")

                # Accept EULA
                eula_path = os.path.join(server_folder, "eula.txt")
                with open(eula_path, "w") as f:
                    f.write("eula=true\n")
                update_label("DEBUG: EULA accepted")

                # Load java path from config.json
                with open("config.json", "r") as f:
                    config = json.load(f)
                java_path = config.get("java_path", "java")  # fallback to "java" if not set

                # Run server to generate files
                proc = subprocess.Popen(
                    [java_path, f"-Xmx{server_ram}M", "-Xms1024M", "-jar", "server.jar", "nogui"],
                    cwd=server_folder,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    stdin=subprocess.PIPE,  # ✅ allow commands
                    universal_newlines=True,
                    encoding="utf-8",
                    errors="ignore"
                )

                done_seen = False
                for line in proc.stdout:
                    line = line.strip()
                    if line:
                        update_label(f"DEBUG: {line}")
                    if "Done" in line:
                        done_seen = True
                        update_label("DEBUG: Detected 'Done' — stopping server...")
                        break

                if done_seen:
                    time.sleep(3)
                    try:
                        proc.stdin.write("stop\n")
                        proc.stdin.flush()
                        proc.wait(timeout=10)
                    except Exception as e:
                        update_label(f"DEBUG: Failed to stop server gracefully: {e}")
                        proc.kill()

                update_label("DEBUG: Forge server first run completed")
                apply_seed()
                os.remove(installer_path)
                update_label("DEBUG: Forge installer deleted")

            # ==================================================
            # --------------- Shared Setup Code ----------------
            # ==================================================
            elif server_type in ["vanilla", "paper", "fabric"]:
                update_label(f"Setting up {server_type.capitalize()} server...")

                # Accept EULA
                eula_path = os.path.join(server_folder, "eula.txt")
                with open(eula_path, "w") as f:
                    f.write("eula=true\n")
                update_label(f"EULA accepted ({server_type.capitalize()}).")

                # Load java path from config.json
                with open("config.json", "r") as f:
                    config = json.load(f)
                java_path = config.get("java_path", "java")  # fallback to "java" if not set

                # Run the server
                jar_path = os.path.join(server_folder, "server.jar")
                process = subprocess.Popen(
                    [java_path, f"-Xmx{server_ram}M", "-Xms1024M", "-jar", jar_path, "nogui"],
                    cwd=server_folder,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    stdin=subprocess.PIPE,  # ✅ allow commands
                    universal_newlines=True,
                    encoding="utf-8",
                    errors="ignore"
                )

                for line in process.stdout:
                    line = line.strip()
                    if line:
                        update_label(line)
                    if "Done" in line or (server_type == "paper" and "Timings Reset" in line):
                        update_label(f"{server_type.capitalize()} initial setup complete.")
                        try:
                            process.stdin.write("stop\n")
                            process.stdin.flush()
                            process.wait(timeout=10)
                        except Exception as e:
                            update_label(f"Failed to stop {server_type} gracefully: {e}")
                            process.kill()
                        break

                apply_seed()

            else:
                update_label(f"Unknown server type: {server_type}")
                return

            # ---- Save Metadata ----
            server_info = {
                "server_name": server_name,
                "server_ram": server_ram,
                "server_type": server_type,
                "server_version": version,
                "server_status": "Offline"
            }
            with open(os.path.join(server_folder, "server_info.json"), "w") as f:
                json.dump(server_info, f, indent=4)

            update_label("✅ Server Setup Complete!")
            self.toggle_spinner(state=False)
            self.ids.next_btn.disabled = False

        except Exception as e:
            update_label(f"Error during setup: {e}")
            self.toggle_spinner(state=False)

    def next(self):
        """Proceeds to the main screen after setup is complete."""
        self.ids.start.disabled = False
        self.ids.next_btn.disabled = False
        self.manager.current = "homescreen"

    def back(self):
        self.ids.start.disabled = False
        self.manager.current = "finalize"


class Configuration(MDScreen):
    def on_pre_enter(self):
        """Load existing config values when entering screen."""
        config = self.load_config()

        self.ids.java_path.text = config.get("java_path", "")
        self.ids.server_location.text = config.get("server_location", "")
        self.dialog = None

    # ---------------------------
    # JSON CONFIG HELPERS
    # ---------------------------
    def load_config(self):
        """Safely load JSON config."""
        config_path = "config.json"
        if os.path.exists(config_path) and os.path.getsize(config_path) > 0:
            try:
                with open(config_path, "r") as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return {}
        return {}

    def save_config(self, updates):
        """Update and save config.json with new values."""
        config = self.load_config()
        config.update(updates)
        with open("config.json", "w") as f:
            json.dump(config, f, indent=4)

    # ---------------------------
    # JAVA PATH MANAGEMENT
    # ---------------------------
    def edit_java_path(self):
        """Open file dialog to select java.exe."""
        root = tk.Tk()
        root.withdraw()
        file_path = filedialog.askopenfilename(
            title="Select Java executable",
            filetypes=[("Java Executable", "java.exe")],
            initialdir="C:\\Program Files\\Java"
        )
        root.destroy()

        if not file_path:
            return

        if not self.validate_java_path(file_path):
            self.ids.status_label.text = "❌ Invalid Java Path"
            return

        # Save valid java path
        self.save_config({"java_path": file_path})
        self.ids.java_path.text = file_path
        self.ids.status_label.text = "✅ Java path updated"

    def validate_java_path(self, path):
        """Check if given path is a valid Java executable."""
        # Case 1: direct "java" in PATH
        if path.strip().lower() == "java":
            try:
                result = subprocess.run([path, "-version"], capture_output=True, text=True)
                return result.returncode == 0
            except Exception:
                return False

        # Case 2: full path must exist
        if not os.path.exists(path):
            return False

        # If user gave folder, try common sub-paths
        if os.path.isdir(path):
            candidates = [
                os.path.join(path, "bin", "java"),
                os.path.join(path, "java"),
            ]
            for candidate in candidates:
                if os.path.exists(candidate):
                    path = candidate
                    break
            else:
                return False

        # Final test: run `java -version`
        try:
            result = subprocess.run([path, "-version"], capture_output=True, text=True)
            return result.returncode == 0 and "version" in (result.stdout + result.stderr).lower()
        except Exception:
            return False

    # ---------------------------
    # SERVER LOCATION MANAGEMENT
    # ---------------------------
    def edit_server_path(self):
        """Open directory dialog for server location."""
        root = tk.Tk()
        root.withdraw()
        folder_path = filedialog.askdirectory(
            title="Select Location for Server",
            initialdir="C:\\"
        )
        root.destroy()

        if not folder_path:
            return

        if not os.path.isdir(folder_path):
            self.ids.status_label.text = "❌ Invalid Folder Location"
            return

        self.save_config({"server_location": folder_path})
        self.ids.server_location.text = folder_path
        self.ids.status_label.text = "✅ Server location updated"

    # ---------------------------
    # LICENSE POPUP
    # ---------------------------
    def open_license(self, *args):
        if not self.dialog:
            license_text = """\
License Copyright 2022 Developed Methods LLC

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED "AS IS" WITHOUT ANY WARRANTIES, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS FOR A PARTICULAR PURPOSE.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT, ARISING
IN ANY WAY OUT OF THE USE OF THIS SOFTWARE.

Note: This project is not affiliated with Playit.gg or Developed Methods LLC.
The Playit.gg agent is provided as-is under its license.
"""

            scroll = MDScrollView(size_hint=(1, None), height=dp(500))
            box = MDBoxLayout(
                orientation="vertical",
                padding=dp(20),
                spacing=dp(10),
                size_hint_y=None
            )
            box.bind(minimum_height=box.setter("height"))

            label = MDLabel(
                text=license_text,
                size_hint_y=None,
                text_size=(dp(700), None),
                halign="left",
                valign="top",
                theme_text_color="Custom",
                text_color=(0.1, 0.1, 0.1, 1),
                font_style="Body1",
            )
            label.bind(texture_size=lambda inst, val: setattr(inst, "height", val[1]))

            box.add_widget(label)
            scroll.add_widget(box)

            self.dialog = MDDialog(
                title="Playit.gg License",
                type="custom",
                content_cls=scroll,
                radius=[20, 20, 20, 20],
                md_bg_color=(1, 1, 1, 1),
                size_hint=(0.9, 0.9),
                buttons=[
                    MDRaisedButton(
                        text="CLOSE",
                        md_bg_color=(0.2, 0.4, 1, 1),
                        text_color=(1, 1, 1, 1),
                        on_release=lambda x: self.dialog.dismiss(),
                    )
                ],
            )

        self.dialog.open()

    # ---------------------------
    # NAVIGATION
    # ---------------------------
    def back(self):
        self.manager.current = "homescreen"

class Server_Status(MDScreen):
    server_path = ""
    server_name = ""
    MAX_LOG_LINES = 1000
    server_type = "Unknown"
    manager = ObjectProperty()

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.process = None
        self.monitor_thread = None
        self.running = False
        # Graph reference
        self.graph = None
        self.cpu_plot = None
        self.ram_plot = None

        # Storage for points
        self.graph_x = 0
        self.cpu_points = []
        self.ram_points = []

        # Build graph once UI is ready
        Clock.schedule_once(self.build_graph, 1)
        #Playit.gg running
        self.playit_process = None
        self.playit_ip = None
        #monitor players
        self.monitor_thread = None
        self.stop_monitor = False
        #setup for Log
        self.logs = []
        self.log_file = None
        #monitor others
        self.start_time = None
        self.uptime_event = None
    def on_enter(self, *args):
        self.update_tab_colors(self.manager.current)

    def build_graph(self,*args):
        """Builds the live CPU/RAM usage graph and replaces placeholder."""
        # ---------------- Graph setup ----------------
        self.graph = Graph(
            xlabel="Time",  # white label
            ylabel="Usage%",
            x_ticks_minor=5,
            x_ticks_major=10,
            y_ticks_major=10,
            y_grid_label=True,
            x_grid_label=False,
            padding=50,
            x_grid=True,
            y_grid=True,
            xmin=0,
            xmax=50,
            ymin=0,
            ymax=100,
            size_hint=(1, 1),
            background_color=[0.05, 0.05, 0.05, 1],  # dark gray background
            border_color=[0, 0, 0, 1],  # white axes
            tick_color=[0, 0, 0, 1]  # white ticks
        )

        # CPU (red) + RAM (green) plots with thicker lines
        self.cpu_plot = MeshLinePlot(color=[1, 0.2, 0.2, 1])
        self.cpu_plot.line_width = dp(2.5)

        self.ram_plot = MeshLinePlot(color=[0.2, 1, 0.2, 1])
        self.ram_plot.line_width = dp(2.5)

        self.graph.add_plot(self.cpu_plot)
        self.graph.add_plot(self.ram_plot)

        # Replace placeholder with actual graph
        if "graph_placeholder" in self.ids:
            self.ids.graph_container.remove_widget(self.ids.graph_placeholder)
        self.ids.graph_container.add_widget(self.graph, index=0)

        # ---------------- Legend ----------------
        self.ids.legend_box.clear_widgets()

        def make_legend(color, text):
            box = BoxLayout(
                orientation="horizontal",
                spacing=8,
                size_hint_x=None,
                width=130,
                padding=(0, 0, 0, 0)
            )

            # Colored dot (dynamic position)
            with box.canvas.before:
                Color(*color)
                dot = Ellipse(size=(14, 14), pos=box.pos)

            def update_dot(instance, value):
                dot.pos = (box.x + 5, box.center_y - 7)  # keep circle left + vertically centered
                dot.size = (14, 14)

            box.bind(pos=update_dot, size=update_dot)

            lbl = Label(
                text=text,
                markup=True,
                color=(0, 0, 0, 1),  # BLACK text
                font_size="14sp",
                halign="left",
                valign="middle"
            )
            box.add_widget(lbl)
            return box


        self.cpu_label = make_legend([1, 0.2, 0.2, 1], "CPU: 0%")
        self.ram_label = make_legend([0.2, 1, 0.2, 1], "RAM: 0%")

        self.ids.legend_box.add_widget(self.cpu_label)
        self.ids.legend_box.add_widget(self.ram_label)

        # ---------------- Init data points ----------------
        self.cpu_points = [(x, 0) for x in range(51)]
        self.ram_points = [(x, 0) for x in range(51)]
        self.cpu_plot.points = self.cpu_points
        self.ram_plot.points = self.ram_points

        # Start updating graph every second
        Clock.schedule_interval(self.poll_system_usage, 1)

    def poll_system_usage(self, dt):
        cpu = psutil.cpu_percent()
        ram = psutil.virtual_memory().percent
        self.update_graph(cpu, ram)

    def update_graph(self,cpu,ram):

        # Shift old points left
        self.cpu_points = [(x - 1, y) for (x, y) in self.cpu_points if x > 0]
        self.ram_points = [(x - 1, y) for (x, y) in self.ram_points if x > 0]

        # Append new point at right edge (x=50)
        self.cpu_points.append((50, cpu))
        self.ram_points.append((50, ram))

        # Update plots
        self.cpu_plot.points = self.cpu_points
        self.ram_plot.points = self.ram_points

        # Update labels
        self.cpu_label.children[0].text = f"CPU: {cpu:.1f}%"
        self.ram_label.children[0].text = f"RAM: {ram:.1f}%"

    def load_server(self, path, server_name):
        """Open server screen, load configs, and prepare log file."""
        if path:
            self.server_path = path
        if server_name:
            self.server_name = server_name

        # --- Ensure server folder exists ---
        os.makedirs(self.server_path, exist_ok=True)

        # --- Setup log file (reset each session) ---
        self.log_file = os.path.join(self.server_path, "Server_log.txt")
        try:
            with open(self.log_file, "w", encoding="utf-8") as f:
                f.write("")  # clear logs for new session
        except Exception as e:
            print(f"[ERROR] Could not reset log file: {e}")

        # --- Load server_info.json ---
        info_data = {}
        info_path = os.path.join(self.server_path, "server_info.json")
        if os.path.exists(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    info_data = json.load(f)
            except Exception as e:
                self.replace_log(f"[ERROR] Failed to load server_info.json: {e}")

        # --- Load server.properties (manual parse, not strict INI) ---
        props_data = {}
        props_path = os.path.join(self.server_path, "server.properties")
        if os.path.exists(props_path):
            try:
                with open(props_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            props_data[k.strip()] = v.strip()
            except Exception as e:
                print(f"[ERROR] Failed to read server.properties: {e}")

        # --- Server type (from JSON, fallback to Unknown) ---
        self.server_type = info_data.get("server_type", "Unknown")

        # --- Update UI labels ---
        self.ids.server_name_label.text = info_data.get("server_name", self.server_name)
        self.ids.ram_label.text = f"RAM: {info_data.get('server_ram', 'N/A')}"
        self.ids.version_label.text = f"Version: {info_data.get('server_version', 'Unknown')}"
        self.ids.type_label.text = f"Type: {self.server_type}"

    def load_config(self,config_path="config.json"):
        if not os.path.exists(config_path):
            print("[INFO] Config file not found, creating default config.json")
            default_config = {
                "setup": False,
                "server_location": os.getcwd(),  # fallback to current directory
                "java_path": "java",  # default to system java
            }
            with open(config_path, "w") as f:
                json.dump(default_config, f, indent=4)
            return default_config

        with open(config_path, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                print("[ERROR] Config file is corrupted, resetting...")
                return {}

    def start_server(self):
        """
        Start Minecraft server (based on server_type) with Playit tunnel and RCON monitoring.
        """
        # --- Update Start/Stop UI ---
        self.ids.start_btn.disabled = True
        self.ids.stop_btn.disabled = False
        self.ids.restart_btn.disabled = False

        # --- Load config ---
        config = self.load_config()
        base_location = config.get("server_location", os.getcwd())
        server_folder = os.path.join(base_location, self.server_name)
        jar_path = os.path.join(server_folder, "server.jar")
        info_path = os.path.join(server_folder, "server_info.json")

        # --- RAM allocation ---
        allocated_server_ram = 2048
        if os.path.exists(info_path):
            with open(info_path, "r", encoding="utf-8") as f:
                info_data = json.load(f)
                allocated_server_ram = info_data.get("server_ram", 2048)

        ram_max = f"{allocated_server_ram // 1024}G"

        # --- Safety check for JAR ---
        if not os.path.exists(jar_path):
            Clock.schedule_once(lambda dt: self.replace_log(f"[ERROR] server.jar not found at {jar_path}"))
            Clock.schedule_once(lambda dt: setattr(self.ids.server_status, "text", "SERVER: ERROR"))
            return

        # --- Ensure RCON is enabled ---
        rcon_password, rcon_port = self.ensure_rcon()

        # --- Start Playit tunnel ---
        threading.Thread(target=self.start_playit, daemon=True).start()

        # --- Build launch command ---
        # Load java path from config.json
        with open("config.json", "r") as f:
            config = json.load(f)
        java_path = config.get("java_path", "java")  # fallback to "java" if not set

        # Prepare the command
        java_cmd = [java_path, f"-Xmx{ram_max}", "-Xms1G", "-jar", jar_path, "nogui"]

        # --- Progress maps ---
        progress_maps = {
            "vanilla": {"Starting minecraft server version": 20, "Loading properties": 30,
                        "Default game type": 40, "Preparing level": 50, "Preparing spawn area": 70, "Done": 100},
            "paper": {"Paper": 10, "Loading properties": 20, "This server is running": 30,
                      "Preparing level": 50, "Preparing spawn area": 70, "Done": 100},
            "purpur": {"Purpur": 10, "Loading properties": 20, "This server is running": 30,
                       "Preparing level": 50, "Preparing spawn area": 70, "Done": 100},
            "fabric": {"Fabric": 10, "Loading for game": 20, "Loading properties": 30,
                       "Preparing level": 50, "Preparing spawn area": 70, "Done": 100},
            "forge": {"Forge": 10, "Loading libraries": 20, "Loading properties": 30,
                      "Preparing level": 50, "Preparing spawn area": 70, "Done": 100},
        }

        progress_map = progress_maps.get(self.server_type.lower(), progress_maps["vanilla"])

        def launch_server():
            try:
                # --- Launch server process ---
                self.process = subprocess.Popen(
                    java_cmd,
                    cwd=server_folder,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True
                )
                self.running = True

                # Initial UI update
                Clock.schedule_once(lambda dt: setattr(self.ids.server_status, "text", "SERVER: STARTING..."))
                Clock.schedule_once(lambda dt: setattr(self.ids.progress_bar_status, "value", 0))
                Clock.schedule_once(lambda dt: setattr(self.ids.server_log, "text", "Starting server..."))

                # Function to safely enable command input in the console screen
                def enable_command_input():
                    try:
                        console_screen = self.manager.get_screen(
                            "console")  # Change 'console' if your screen has a different name
                        console_screen.ids.command_input.disabled = False
                    except Exception as e:
                        self.replace_log(f"[ERROR] Failed to enable command input: {e}")

                # --- Read server output ---
                for line in self.process.stdout:
                    line = line.strip()
                    if not line:
                        continue

                    # Update server log
                    Clock.schedule_once(lambda dt, msg=line: self.replace_log(msg))

                    # Update progress bar
                    for key, val in progress_map.items():
                        if key in line:
                            Clock.schedule_once(lambda dt, v=val: setattr(self.ids.progress_bar_status, "value", v))
                            if key == "Done":
                                Clock.schedule_once(lambda dt: self.hide_progress())
                                Clock.schedule_once(
                                    lambda dt: setattr(self.ids.server_status, "text", "SERVER: ONLINE"))
                                #setting up server_info
                                serfer_info = {}
                                server_info_path = os.path.join(self.server_path, "server_info.json")
                                if os.path.exists(info_path):
                                    try:
                                        with open(server_info_path, "r", encoding="utf-8") as f:
                                            serfer_info= json.load(f)
                                    except Exception as e:
                                        self.replace_log(f"[ERROR] Failed to load server_info.json: {e}")

                                    serfer_info["server_players"] = "Players: N/A"
                                    serfer_info["player_list"] = []
                                    serfer_info["server_tps"] = "N/A"
                                    serfer_info["server_status"] = "Online"
                                    try:
                                        with open(server_info_path, "w", encoding="utf-8") as f:
                                            json.dump(serfer_info, f, indent=4)
                                    except Exception as e:
                                        self.replace_log(f"[ERROR] Failed to save server_info.json: {e}")

                                Clock.schedule_once(lambda dt: enable_command_input())
                                # Start resource monitoring
                                threading.Thread(target=self.monitor_resources, daemon=True).start()
                                self.start_uptime()


                    # Detect RCON readiness
                    if "RCON running on" in line:
                        self.monitor_players()
                        self.monitor_battery()

            except Exception as e:
                err_msg = f"Error starting server: {e}"
                Clock.schedule_once(lambda dt, msg=err_msg: self.replace_log(msg))
                Clock.schedule_once(lambda dt: setattr(self.ids.server_status, "text", "SERVER: ERROR"))

        # --- Run server in background ---
        threading.Thread(target=launch_server, daemon=True).start()

    def hide_progress(self):
        """Hide progress bar when startup is complete"""
        self.ids.progress_bar_status.opacity = 0
        self.ids.progress_bar_status.disabled = True

    def replace_log(self, msg: str):
        """Update status line, console log (latest line), and write to file with cap of 1000 lines."""

        # --- Status screen (latest line only) ---
        self.ids.server_log.text = msg

        # --- Write to server log file ---
        if self.log_file:
            try:
                with open(self.log_file, "a", encoding="utf-8") as f:
                    f.write(msg + "\n")

                # --- Trim file if >1000 lines ---
                with open(self.log_file, "r+", encoding="utf-8") as f:
                    lines = f.readlines()
                    if len(lines) > 1000:
                        # Keep only last 1000 lines
                        f.seek(0)
                        f.writelines(lines[-1000:])
                        f.truncate()

            except Exception as e:
                print(f"[ERROR] Failed to write log: {e}")

    def start_playit(self):
        """
        Start playit.exe in the background and keep it running.
        Returns the IP if already fetched, else a placeholder text.
        """

        def _run_playit():
            try:
                self.playit_process = subprocess.Popen(
                    ["playit.exe"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True
                )

                for line in self.playit_process.stdout:
                    line = line.strip()
                    # Extract joinmc.link hostnames
                    match = re.search(r"[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-]+\.joinmc\.link", line)
                    if match and self.playit_ip is None:
                        self.playit_ip = match.group(0)
                        # Update the UI with the IP asynchronously
                        Clock.schedule_once(lambda dt, ip=self.playit_ip: setattr(self.ids.server_ip, "text", ip))

            except Exception as e:
                print(f"[PLAYIT ERROR] {e}")

        # Start background daemon thread
        threading.Thread(target=_run_playit, daemon=True).start()

        # Return IP immediately if fetched, else placeholder
        return self.playit_ip or "Fetching IP..."

    def stop_server(self):
        """
        Stop the Minecraft server gracefully using RCON/stdin,
        fall back to terminate/kill if needed.
        """
        # --- update start stop UI ---
        self.ids.start_btn.disabled = False
        self.ids.stop_btn.disabled = True
        self.ids.restart_btn.disabled = True

        if not self.process or not self.running:
            Clock.schedule_once(lambda dt: self.replace_log("[INFO] No server process is running"))
            return

        def _stop_thread():
            try:
                Clock.schedule_once(lambda dt: self.replace_log("[INFO] Attempting graceful shutdown..."))

                stopped = False

                # --- Try RCON stop first ---
                try:
                    from mcrcon import MCRcon
                    rcon_password, rcon_port = self.ensure_rcon()
                    with MCRcon("127.0.0.1", rcon_password, port=rcon_port) as rcon:
                        rcon.command("stop")
                        stopped = True
                        Clock.schedule_once(lambda dt: self.replace_log("[INFO] Sent 'stop' via RCON"))
                except Exception as e:
                    Clock.schedule_once(lambda dt, msg=f"[WARN] Could not stop via RCON: {e}": self.replace_log(msg))

                # --- Fallback: send stop via stdin ---
                if not stopped and self.process.stdin:
                    try:
                        self.process.stdin.write("stop\n")
                        self.process.stdin.flush()
                        stopped = True
                        Clock.schedule_once(lambda dt: self.replace_log("[INFO] Sent 'stop' via stdin"))
                    except Exception as e:
                        Clock.schedule_once(
                            lambda dt, msg=f"[WARN] Could not send stop via stdin: {e}": self.replace_log(msg))

                # --- Wait for graceful shutdown ---
                try:
                    self.process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    Clock.schedule_once(
                        lambda dt: self.replace_log("[WARN] Server did not stop gracefully, terminating..."))
                    self.process.terminate()
                    try:
                        self.process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        Clock.schedule_once(lambda dt: self.replace_log("[ERROR] Force killing server process..."))
                        self.process.kill()

                # --- Cleanup ---
                self.running = False
                self.stop_monitoring()
                Clock.schedule_once(lambda dt: setattr(self.ids.server_status, "text", "SERVER:Offline"))
                Clock.schedule_once(lambda dt: setattr(self.ids.progress_bar_status, "value", 0))
                Clock.schedule_once(lambda dt: self.replace_log("[INFO] Server stopped successfully"))
                self.stop_uptime()
                self.stop_battery_monitor()
                self.ids.tps_label.text = "Tps:N/A"
                self.ids.players_label.text ="Players: N/A"
                info_data = {}
                info_path = os.path.join(self.server_path, "server_info.json")
                if os.path.exists(info_path):
                    try:
                        with open(info_path, "r", encoding="utf-8") as f:
                            info_data = json.load(f)
                    except Exception as e:
                        self.replace_log(f"[ERROR] Failed to load server_info.json: {e}")

                    info_data["server_players"] = "Players: N/A"
                    info_data["player_list"] = []
                    info_data["server_tps"] = "N/A"
                    info_data["server_status"] = "Offline"

                    self.stop_playit()
                    try:
                        with open(info_path, "w", encoding="utf-8") as f:  # write mode
                            json.dump(info_data, f, indent=4)
                    except Exception as e:
                        self.replace_log(f"[ERROR] Failed to write server_info.json: {e}")
            except Exception as e:
                Clock.schedule_once(lambda dt, msg=f"[ERROR] Failed to stop server: {e}": self.replace_log(msg))

        # 🔑 run in background so UI doesn’t freeze
        threading.Thread(target=_stop_thread, daemon=True).start()

    def restart_server(self):
        """
        Restart the Minecraft server by stopping and starting again.
        """
        self.replace_log("[INFO] Restarting server...")
        self.stop_server()
        self.ids.start_btn.disabled = True
        self.ids.stop_btn.disabled = True
        self.ids.restart_btn.disabled = True
        Clock.schedule_once(lambda dt: self.start_server(), 10)

    def get_playit_ip(self):
        """
        Return the IP if already fetched, else placeholder
        """
        return self.playit_ip or "Fetching IP..."

    def stop_playit(self):
        """Stop Playit tunnel process if running"""
        try:
            if hasattr(self, "playit_process") and self.playit_process:
                self.playit_process.terminate()
                self.playit_process = None
                self.playit_ip = None
                Clock.schedule_once(lambda dt: setattr(self.ids.server_ip, "text", "Tunnel stopped"))
                self.replace_log("[Playit] Tunnel stopped")
            else:
                self.replace_log("[Playit] No tunnel running")
        except Exception as e:
            self.replace_log(f"[PLAYIT ERROR] Failed to stop tunnel: {e}")

    def monitor_resources(self):
        """Monitor CPU/RAM every 2s and update graph + labels"""
        while self.running and self.process and self.process.poll() is None:
            servercpu = psutil.cpu_percent()
            serverram = psutil.virtual_memory().percent

            # Capture values into local variables so lambdas don't lose scope
            tps_text = "20"
            cpu_val = servercpu
            ram_val = serverram

            # Schedule updates on the UI thread
            Clock.schedule_once(lambda dt, text=tps_text: setattr(self.ids.tps_label, "text", text))
            Clock.schedule_once(lambda dt, c=cpu_val, r=ram_val: self.update_graph(c, r))

            time.sleep(2)  # wait 2s before polling again

    def copy_ip(self):
        ip = self.ids.server_ip.text
        Clipboard.copy(ip)


    def monitor_players(self, interval=5):
        def _monitor():
            while not self.stop_monitor:
                try:
                    props_path = os.path.join(self.server_path, "server.properties")
                    if not os.path.exists(props_path):
                        print(f"[ERROR] server.properties not found at {props_path}")
                        break

                    props = {}
                    lines = []
                    changed = False

                    # read props
                    with open(props_path, "r") as f:
                        for line in f:
                            if "=" in line and not line.startswith("#"):
                                k, v = line.strip().split("=", 1)
                                props[k] = v
                            lines.append(line)

                    # ensure query enabled
                    if props.get("enable-query", "false") != "true":
                        props["enable-query"] = "true"
                        new_lines = []
                        for line in lines:
                            if line.startswith("enable-query="):
                                new_lines.append("enable-query=true\n")
                            else:
                                new_lines.append(line)
                        lines = new_lines
                        with open(props_path, "w") as f:
                            f.writelines(lines)
                        changed = True

                    ip = props.get("server-ip", "127.0.0.1") or "127.0.0.1"
                    port = int(props.get("query.port", props.get("server-port", 25565)))
                    max_players = int(props.get("max-players", 0))

                    if changed:
                        self.restart_server()
                    else:
                        try:
                            server = JavaServer.lookup(f"{ip}:{port}")
                            status = server.status()
                            players = status.players.sample or []
                            names = [p.name for p in players]

                            Clock.schedule_once(lambda dt: self.update_players_ui(len(names), max_players, names))

                        except Exception as e:
                            print(f"[ERROR] Failed to query server: {e}")

                except Exception as e:
                    print(f"[ERROR] Monitoring failed: {e}")

                time.sleep(interval)

        self.stop_monitor = False
        self.monitor_thread = threading.Thread(target=_monitor, daemon=True)
        self.monitor_thread.start()

    def stop_battery_monitor(self):
        """Stop the battery monitoring thread."""
        self.battery_running = False

    def stop_monitoring(self):
        self.stop_monitor = True
        if self.monitor_thread:
            self.monitor_thread.join()

    def ensure_rcon(self):
        """
        Ensures that RCON is enabled in server.properties and sets a password if missing.
        Must be called **before starting the server**.
        """
        props_path = os.path.join(self.server_path, "server.properties")
        default_password = "MySecureRconPassword123"  # change this if needed
        default_port = 25575

        if not os.path.exists(props_path):
            print(f"[ERROR] server.properties not found in {self.server_path}")
            return default_password, default_port

        props = {}
        with open(props_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    props[k.strip()] = v.strip()

        modified = False

        # Enable RCON if not already
        if props.get("enable-rcon", "false").lower() != "true":
            props["enable-rcon"] = "true"
            modified = True

        # Set RCON password if missing
        if "rcon.password" not in props or not props["rcon.password"].strip():
            props["rcon.password"] = default_password
            modified = True

        # Set RCON port if missing
        if "rcon.port" not in props:
            props["rcon.port"] = str(default_port)
            modified = True

        # Save any changes back to server.properties
        if modified:
            with open(props_path, "w") as f:
                for k, v in props.items():
                    f.write(f"{k}={v}\n")
            print("[INFO] RCON settings updated in server.properties")

        # Return values for connecting
        rcon_password = props["rcon.password"]
        rcon_port = int(props.get("rcon.port", default_port))
        return rcon_password, rcon_port

    def update_players_ui(self, online, max_players, names):
        """
        Update players UI efficiently:
        Layout -> [Head]   [ Name (big) ]   [Kick] [Ban]
        """

        def _update(dt):
            self.ids.players_label.text = f"Players: {online}/{max_players}"

            # Ensure mapping exists
            if not hasattr(self.ids.scroll_box, "children_map"):
                self.ids.scroll_box.children_map = {}

            current_names = set(self.ids.scroll_box.children_map.keys())
            new_names = set(names)


            # --- Remove players who left ---
            for player in current_names - new_names:
                widget = self.ids.scroll_box.children_map[player]
                self.ids.scroll_box.remove_widget(widget)
                del self.ids.scroll_box.children_map[player]

            # --- Add players who joined ---
            for player in new_names - current_names:
                skin_url = f"https://minotar.net/helm/{player}/64"

                # Whole row card
                player_card = MDCard(
                    orientation="horizontal",
                    size_hint_y=None,
                    height="80dp",
                    padding="10dp",
                    spacing="15dp",
                    radius=[12],
                    md_bg_color=(0.95, 0.95, 0.97, 1),  # light white-gray
                )

                # Player Head
                img = FitImage(
                    source=skin_url,
                    size_hint=(None, None),
                    size=("56dp", "56dp"),
                )

                # Player Name (center, bigger font)
                name_label = MDLabel(
                    text=player,
                    halign="center",
                    font_style="H6",  # bigger
                    theme_text_color="Custom",
                    text_color=(0.1, 0.1, 0.1, 1),
                    size_hint_x=1
                )

                # Kick Button
                kick_btn = MDRaisedButton(
                    text="Kick",
                    md_bg_color=(0.9, 0.3, 0.3, 1),
                    text_color=(1, 1, 1, 1),
                    size_hint=(None, None),
                    size=("70dp", "40dp"),
                    on_release=lambda x, p=player: self.kick_player(p),
                )

                # Ban Button
                ban_btn = MDRaisedButton(
                    text="Ban",
                    md_bg_color=(0.6, 0.1, 0.1, 1),
                    text_color=(1, 1, 1, 1),
                    size_hint=(None, None),
                    size=("70dp", "40dp"),
                    on_release=lambda x, p=player: self.ban_player(p),
                )

                # Add widgets to row
                player_card.add_widget(img)
                player_card.add_widget(name_label)
                player_card.add_widget(kick_btn)
                player_card.add_widget(ban_btn)

                # Save reference
                self.ids.scroll_box.children_map[player] = player_card
                self.ids.scroll_box.add_widget(player_card)

            # --- Update server_info.json ---
            info_path = os.path.join(self.server_path, "server_info.json")
            info_data = {}
            if os.path.exists(info_path):
                try:
                    with open(info_path, "r", encoding="utf-8") as f:
                        info_data = json.load(f)
                except Exception as e:
                   self.replace_log(f"[ERROR] Failed to read server_info.json: {e}")

            info_data["server_players"] = f"{online}/{max_players}"
            info_data["player_list"] = names

            try:
                with open(info_path, "w", encoding="utf-8") as f:
                    json.dump(info_data, f, indent=4)
            except Exception as e:
                self.replace_log(f"[ERROR] Failed to write server_info.json: {e}")

        Clock.schedule_once(_update)

    # --- Kick player method ---
    def kick_player(self, player_name):
        """
        Kick a player from the server using RCON command.
        """
        try:
            if self.process and self.process.stdin:
                cmd = f"kick {player_name}"
                self.process.stdin.write(cmd + "\n")
                self.process.stdin.flush()
                self.replace_log(f"[INFO] Sent command: {cmd}")
            else:
                self.replace_log("[ERROR] Server not running or stdin unavailable")
        except Exception as e:
            self.replace_log(f"[ERROR] Failed to kick player {player_name}: {e}")

    # --- Ban player method ---
    def ban_player(self, player_name):
        """
        Ban a player from the server using RCON command.
        """
        try:
            if self.process and self.process.stdin:
                cmd = f"ban {player_name}"
                self.process.stdin.write(cmd + "\n")
                self.process.stdin.flush()
                self.replace_log(f"[INFO] Sent command: {cmd}")
            else:
                self.replace_log("[ERROR] Server not running or stdin unavailable")
        except Exception as e:
            self.replace_log(f"[ERROR] Failed to ban player {player_name}: {e}")

    def start_uptime(self):
        """Start tracking server uptime."""
        self.start_time = datetime.datetime.now()
        if self.uptime_event:
            self.uptime_event.cancel()
        self.uptime_event = Clock.schedule_interval(self.update_uptime, 1)

    def stop_uptime(self):
        """Stop uptime when server shuts down."""
        if self.uptime_event:
            self.uptime_event.cancel()
            self.uptime_event = None
        self.ids.server_uptime.text = "Uptime: 00:00:00"

    def update_uptime(self, dt):
        """Update uptime label every second."""
        if not self.start_time:
            return
        uptime = datetime.datetime.now() - self.start_time
        # Format as HH:MM:SS
        hours, remainder = divmod(int(uptime.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        self.ids.server_uptime.text = f"Uptime: {hours:02}:{minutes:02}:{seconds:02}"

    def monitor_battery(self, interval=30):
        """Check battery percent & time left, update UI every 30s."""

        def _battery_loop():
            while self.running:
                try:
                    battery = psutil.sensors_battery()
                    if battery:
                        percent = battery.percent
                        if battery.secsleft == psutil.POWER_TIME_UNLIMITED:
                            time_left = "Calculating..."
                        elif battery.secsleft == psutil.POWER_TIME_UNKNOWN:
                            time_left = "Unknown"
                        else:
                            hrs, rem = divmod(battery.secsleft, 3600)
                            mins, _ = divmod(rem, 60)
                            time_left = f"{hrs}h {mins}m"

                        text = f"Battery: {percent:.0f}% ({time_left})"
                        Clock.schedule_once(lambda dt, t=text: setattr(self.ids.battery_label, "text", t))
                except Exception as e:
                    print(f"[BATTERY ERROR] {e}")
                time.sleep(interval)

        threading.Thread(target=_battery_loop, daemon=True).start()

    @staticmethod
    def get_server_log_info(instance):
        """Return server path for a given Server_Status instance."""
        if not instance or not instance.server_path:
            return None
        return instance.server_path

    def set_screen(self, screen_name):
        # Switch screen
        self.manager.current = screen_name
        # Update bottom tab colors
        self.update_tab_colors(screen_name)

    def update_tab_colors(self, active_screen):
        # Default = white
        inactive_color = (1, 1, 1, 1)
        active_color = (0.25, 0.5, 1, 1)

        # Reset all tabs to white
        self.ids.tab_status.text_color = inactive_color
        self.ids.tab_players.text_color = inactive_color
        self.ids.tab_console.text_color = inactive_color
        self.ids.tab_logs.text_color = inactive_color
        self.ids.tab_props.text_color = inactive_color
        self.ids.tab_home.text_color = inactive_color

        # Set active tab color
        if active_screen == "status":
            self.ids.tab_status.text_color = active_color
        elif active_screen == "players":
            self.ids.tab_players.text_color = active_color
        elif active_screen == "console":
            self.ids.tab_console.text_color = active_color
        elif active_screen == "server_file":
            self.ids.tab_logs.text_color = active_color
        elif active_screen == "server_properties":
            self.ids.tab_props.text_color = active_color
        elif active_screen == "homescreen":
            self.ids.tab_home.text_color = active_color
class Server_Console(MDScreen):
    MAX_LOG_LINES = 1000
    manager = ObjectProperty()

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.log_file = None
        self.server_info_file = None
        self.file_manager = MDFileManager(
            exit_manager=self.close_file_manager,
            select_path=self.save_logs_to_path,
            preview=False,
        )
    def on_enter(self, *args):
        self.update_tab_colors(self.manager.current)

    def on_pre_enter(self):
        self.attach_to_server()

    def set_screen(self, screen_name):
        # Switch screen
        self.manager.current = screen_name
        # Update bottom tab colors
        self.update_tab_colors(screen_name)

    def update_tab_colors(self, active_screen):
        # Default = white
        inactive_color = (1, 1, 1, 1)
        active_color = (0.25, 0.5, 1, 1)

        # Reset all tabs to white
        self.ids.tab_status.text_color = inactive_color
        self.ids.tab_players.text_color = inactive_color
        self.ids.tab_console.text_color = inactive_color
        self.ids.tab_logs.text_color = inactive_color
        self.ids.tab_props.text_color = inactive_color
        self.ids.tab_home.text_color = inactive_color

        # Set active tab color
        if active_screen == "status":
            self.ids.tab_status.text_color = active_color
        elif active_screen == "players":
            self.ids.tab_players.text_color = active_color
        elif active_screen == "console":
            self.ids.tab_console.text_color = active_color
        elif active_screen == "server_file":
            self.ids.tab_logs.text_color = active_color
        elif active_screen == "server_properties":
            self.ids.tab_props.text_color = active_color
        elif active_screen == "homescreen":
            self.ids.tab_home.text_color = active_color

    def attach_to_server(self):
        """Attach console to the currently active Server_Status instance and load logs."""
        try:
            server_status_screen = self.manager.get_screen("status")
            self.server_path = Server_Status.get_server_log_info(server_status_screen)

            if not self.server_path:
                self.ids.server_log.text = "[ERROR] No server path available"
                return

            # Point to files
            self.log_file = os.path.join(self.server_path, "Server_log.txt")
            self.server_info_file = os.path.join(self.server_path, "server_info.json")

            # Initial refresh
            self.refresh_logs()
            self.refresh_server_info()

            # Auto-refresh every 2s
            Clock.schedule_interval(lambda dt: self.refresh_logs(), 2)
            Clock.schedule_interval(lambda dt: self.refresh_server_info(), 2)

        except Exception as e:
            self.ids.server_log.text = f"[ERROR] Could not attach to server: {e}"

    # -------- Logs --------
    def refresh_logs(self):
        """Load last MAX_LOG_LINES from the log file into the console UI with colors."""

        if not self.log_file or not os.path.exists(self.log_file):
            self.ids.server_log.text = "[color=FFFFFF][No log file found][/color]"
            self.ids.server_log.texture_update()
            self.ids.server_log.height = self.ids.server_log.texture_size[1]
            return

        try:
            with open(self.log_file, "r", encoding="utf-8") as f:
                lines = f.readlines()

            lines = lines[-self.MAX_LOG_LINES:]

            colored_text = ""
            for line in lines:
                line = line.rstrip()  # remove newline

                # Determine color
                if "ERROR" in line:
                    colored_text += f"[color=FF5555]{line}[/color]\n"  # red
                elif "WARN" in line or "WARNING" in line:
                    colored_text += f"[color=FFAA00]{line}[/color]\n"  # yellow
                else:
                    colored_text += f"[color=FFFFFF]{line}[/color]\n"  # true white

            self.ids.server_log.text = colored_text
            self.ids.server_log.texture_update()
            self.ids.server_log.height = self.ids.server_log.texture_size[1]

        except Exception as e:
            self.ids.server_log.text = f"[color=FF5555][ERROR] Failed to read log: {e}[/color]"
            self.ids.server_log.texture_update()
            self.ids.server_log.height = self.ids.server_log.texture_size[1]

    def clear_logs(self):
        """Clear the console and the log file."""
        # Clear the UI
        self.ids.server_log.text = ""

        # Clear the file
        if self.log_file and os.path.exists(self.log_file):
            with open(self.log_file, "w", encoding="utf-8") as f:
                f.write("")  # This clears the file


    # -------- Console Input --------
    def send_command(self, command: str):
        """Send a command to the server and display it in the console with color."""
        self.ids.command_input.text=""
        command = command.strip()
        if not command:
            return
        if command == "/stop" or command == "stop":
            server_status_screen = self.manager.get_screen("status")
            self.server_path = Server_Status.stop_server(server_status_screen)
        else:

            # Show user command in blue
            self.ids.server_log.text += f"\n[color=55aaff]> {command}[/color]"
            self.ids.server_log.texture_update()  # <-- force update
            self.ids.server_log.height = self.ids.server_log.texture_size[1]  # resize
            self.ids.command_input.text = ""

            try:
                server_status_screen = self.manager.get_screen("status")
                process = getattr(server_status_screen, "process", None)

                if process and process.poll() is None and process.stdin:
                    process.stdin.write(command + "\n")
                    process.stdin.flush()
                else:
                    self.ids.server_log.text += "\n[color=ff5555][ERROR] Server process not running or stdin unavailable[/color]"
                    self.ids.server_log.texture_update()
                    self.ids.server_log.height = self.ids.server_log.texture_size[1]

            except Exception as e:
                self.ids.server_log.text += f"\n[color=ff5555][ERROR] Failed to send command: {e}[/color]"
                self.ids.server_log.texture_update()
                self.ids.server_log.height = self.ids.server_log.texture_size[1]

    # -------- Save Logs --------
    def save_logs(self):
        start_path = os.path.expanduser("~")
        self.file_manager.show(start_path)

    def save_logs_to_path(self, path: str):
        if not path.endswith(".txt"):
            path += ".txt"

        with open(path, "w", encoding="utf-8") as f:
            f.write(self.ids.server_log.text)

        self.close_file_manager()
        self.ids.server_log.text += f"\n[INFO] Logs saved to {path}"

    def close_file_manager(self, *args):
        self.file_manager.close()

    # -------- Server Info (TPS / Players) --------
    def refresh_server_info(self):
        """Read TPS and player count from server_info.json and update UI."""
        if not self.server_info_file or not os.path.exists(self.server_info_file):
            self.ids.server_info_label.text = "TPS: N/A\nPlayers: N/A"
            return

        try:
            with open(self.server_info_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            tps = data.get("tps", "N/A")
            players_online = data.get("server_players", "N/A")

            self.ids.server_info_label.text = f"TPS: {tps}\nPlayers: {players_online}"

        except Exception as e:
            self.ids.server_info_label.text = f"TPS: N/A\nPlayers: Error"



class Server_Players(MDScreen):
    """
    Screen to display and manage online players.
    Supports auto-refresh and live search.
    """

    server_data = {}
    _refresh_event = None
    _search_event = None
    _search_lock = threading.Lock()
    search_active = False
    manager = ObjectProperty()
    DEFAULT_AVATAR = "assets/avatars/default.png"

    def on_enter(self):

        self.attach_to_server()
        if not self._refresh_event:
            self._refresh_event = Clock.schedule_interval(self.refresh_players, 2)


        self.update_tab_colors(self.manager.current)

    def on_leave(self):

        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None

    # -------------------------
    # Server Info
    # -------------------------
    def attach_to_server(self):
        try:
            server_status_screen = self.manager.get_screen("status")
            self.server_path = server_status_screen.get_server_log_info(server_status_screen)
            self.server_info_path = os.path.join(self.server_path, "server_info.json")

        except Exception as e:

            self.server_info_path = None

    def refresh_players(self, dt=None):
        """Auto-refresh players list unless search is active."""
        if self.manager.current != "players":
            return

        # Skip refresh if search is ongoing
        if getattr(self, "_search_active", False):

            return

        if not self.server_info_path or not os.path.exists(self.server_info_path):

            self.server_data = {"max_players": 20, "player_list": []}
        else:
            try:
                with open(self.server_info_path, "r", encoding="utf-8") as f:
                    self.server_data = json.load(f)

            except Exception as e:

                self.server_data = {"max_players": 20, "player_list": []}

        names = self.server_data.get("player_list", [])
        if names and isinstance(names[0], dict):
            names = [p.get("name") for p in names]


        max_players = self.server_data.get("max_players", 20)
        self.update_players_ui(len(names), max_players, names)

    # -------------------------
    # Player List UI
    # -------------------------
    def update_players_ui(self, online, max_players, names):


        def _update(dt):
            players_label = self.ids.get("online_players")
            scroll_box = self.ids.get("scroll_box")

            if not players_label or not scroll_box:

                return

            players_label.text = f"Players: {online}/{max_players}"

            if not hasattr(scroll_box, "children_map"):
                scroll_box.children_map = {}

            current_names = set(scroll_box.children_map.keys())
            new_names = set(names)



            # Remove players who left
            for player in current_names - new_names:

                widget = scroll_box.children_map[player]
                scroll_box.remove_widget(widget)
                del scroll_box.children_map[player]

            # Add new players
            for player in new_names - current_names:

                skin_url = f"https://minotar.net/helm/{player}/64"

                card = MDCard(
                    orientation="horizontal",
                    size_hint_y=None,
                    height="80dp",
                    padding="10dp",
                    spacing="15dp",
                    radius=[12],
                    md_bg_color=(0.95, 0.95, 0.97, 1),
                    ripple_behavior=True,
                )

                img = FitImage(
                    source=skin_url,
                    size_hint=(None, None),
                    size=("56dp", "56dp"),
                )

                name_label = MDLabel(
                    text=player,
                    halign="left",
                    valign="center",
                    font_style="H6",
                    theme_text_color="Custom",
                    text_color=(0.1, 0.1, 0.1, 1),
                    size_hint_x=1,
                )

                kick_btn = MDRaisedButton(
                    text="Kick",
                    md_bg_color=(0.9, 0.3, 0.3, 1),
                    text_color=(1, 1, 1, 1),
                    size_hint=(None, None),
                    size=("70dp", "40dp"),
                    on_release=lambda x, p=player: self.kick_player(p),
                )

                ban_btn = MDRaisedButton(
                    text="Ban",
                    md_bg_color=(0.6, 0.1, 0.1, 1),
                    text_color=(1, 1, 1, 1),
                    size_hint=(None, None),
                    size=("70dp", "40dp"),
                    on_release=lambda x, p=player: self.ban_player(p),
                )

                card.add_widget(img)
                card.add_widget(name_label)
                card.add_widget(kick_btn)
                card.add_widget(ban_btn)

                scroll_box.children_map[player] = card
                scroll_box.add_widget(card)



        Clock.schedule_once(_update)

    # -------------------------
    # Player Search
    # -------------------------
    def on_search_text(self, text):
        """Handle live search with debounce and pause auto-refresh while typing."""


        # Cancel old timers
        if self._search_event:
            self._search_event.cancel()
        if hasattr(self, "_resume_event") and self._resume_event:
            self._resume_event.cancel()

        # Mark search active if user typed something
        self._search_active = bool(text.strip())

        # Delay search execution slightly
        self._search_event = Clock.schedule_once(
            lambda dt: self._start_search_thread(text), 0.25
        )

        if self._search_active:
            # Auto-resume refresh after 5s of no typing
            self._resume_event = Clock.schedule_once(
                lambda dt: self._resume_refresh(), 5
            )
        else:
            # If search cleared, resume immediately

            self._resume_refresh()

    def _resume_refresh(self):
        """Resume auto-refresh after search."""

        self._search_active = False
        self.refresh_players()

    def _start_search_thread(self, query):
        def worker(q):
            with self._search_lock:
                all_players = self.server_data.get("player_list", [])
                if all_players and isinstance(all_players[0], dict):
                    all_players = [p.get("name") for p in all_players]



                if not q:
                    results = all_players[:]
                else:
                    q_lower = q.lower()
                    matches = [p for p in all_players if q_lower in p.lower()]
                    exact = [p for p in matches if p.lower() == q_lower]
                    others = [p for p in matches if p not in exact]
                    results = exact + others


                Clock.schedule_once(
                    lambda dt: self.update_players_ui(len(results), self.server_data.get("max_players", 20), results),
                    0,
                )

        threading.Thread(target=worker, args=(query,), daemon=True).start()

    # -------------------------
    # Player Actions
    # -------------------------
    def kick_player(self, player):
        server_status_screen = self.manager.get_screen("status")
        server_status_screen.kick_player(player)

    def ban_player(self, player):
        server_status_screen = self.manager.get_screen("status")
        server_status_screen.ban_player(player)

    def set_screen(self, screen_name):
        # Switch screen
        self.manager.current = screen_name
        # Update bottom tab colors
        self.update_tab_colors(screen_name)

    def update_tab_colors(self, active_screen):
        # Default = white
        inactive_color = (1, 1, 1, 1)
        active_color = (0.25, 0.5, 1, 1)

        # Reset all tabs to white
        self.ids.tab_status.text_color = inactive_color
        self.ids.tab_players.text_color = inactive_color
        self.ids.tab_console.text_color = inactive_color
        self.ids.tab_logs.text_color = inactive_color
        self.ids.tab_props.text_color = inactive_color
        self.ids.tab_home.text_color = inactive_color

        # Set active tab color
        if active_screen == "status":
            self.ids.tab_status.text_color = active_color
        elif active_screen == "players":
            self.ids.tab_players.text_color = active_color
        elif active_screen == "console":
            self.ids.tab_console.text_color = active_color
        elif active_screen == "server_file":
            self.ids.tab_logs.text_color = active_color
        elif active_screen == "server_properties":
            self.ids.tab_props.text_color = active_color
        elif active_screen == "homescreen":
            self.ids.tab_home.text_color = active_color

    def open_banned(self):
        self.manager.current ="banned_players"
    def open_whitelist(self):
        self.manager.current ="whitelist"
    def open_ops(self):
        self.manager.current ="ops"

class Banned_Players(MDScreen):
    server_path = ""
    _refresh_event = None
    _lock = threading.Lock()
    _online_players = []  # Left panel: online
    _banned_players = []  # Right panel: banned

    # --------------------- Lifecycle ---------------------
    def on_enter(self):
        self.attach_to_server()
        if self._refresh_event is None:
            self._refresh_event = Clock.schedule_interval(self._refresh_data, 2)

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None

    def set_screen(self, screen):
        self.manager.current = screen

    # --------------------- Server Attachment ---------------------
    def attach_to_server(self):
        try:
            server_status_screen = self.manager.get_screen("status")
            self.server_path = Server_Status.get_server_log_info(server_status_screen)
            self.load_online_players_threaded()
            self.load_banned_players_threaded()
        except Exception as e:
            print(f"Error attaching to server: {e}")

    def _refresh_data(self, dt):
        if self.manager.current == "banned_players":
            self.load_online_players_threaded()
            self.load_banned_players_threaded()

    # ==================== LEFT PANEL (Online Players) ====================
    def load_online_players_threaded(self):
        threading.Thread(target=self.load_online_players, daemon=True).start()

    def load_online_players(self):
        with self._lock:
            online_players = []
            path = os.path.join(self.server_path, "server_info.json")
            if os.path.exists(path):
                try:
                    with open(path, "r") as f:
                        data = json.load(f)
                        online_players = data.get("player_list", [])
                except Exception as e:
                    print(f"Failed to read server_info.json: {e}")

            self._online_players = online_players
            search_text = self.ids.get("search_all").text if self.ids.get("search_all") else ""
            Clock.schedule_once(lambda dt: self.update_left_panel_ui(search_text))

    def update_left_panel_ui(self, search_text=""):
        scroll_box = self.ids.get("all_players_list")
        ban_button = self.ids.get("ban_button")
        if not scroll_box or not ban_button:
            return

        if not hasattr(scroll_box, "children_map"):
            scroll_box.children_map = {}

        filtered = [p for p in self._online_players if search_text.lower() in p.lower()]

        # Remove cards that are no longer in filtered
        for key in list(scroll_box.children_map.keys()):
            if key not in filtered and key != "no_player":
                scroll_box.remove_widget(scroll_box.children_map[key])
                del scroll_box.children_map[key]

        # Update Ban button state
        if filtered or search_text.strip():
            ban_button.disabled = False  # Enable if there are online players or user typed something
        else:
            ban_button.disabled = True  # Disable only if no players online AND nothing typed

        if filtered:
            for player in filtered:
                if player not in scroll_box.children_map:
                    card = self.create_player_card(player, ban=True)
                    scroll_box.children_map[player] = card
                    scroll_box.add_widget(card)
            # Remove "no player" label if it exists
            if "no_player" in scroll_box.children_map:
                scroll_box.remove_widget(scroll_box.children_map["no_player"])
                del scroll_box.children_map["no_player"]
        else:
            # Show "No player online" label if nothing filtered
            if "no_player" not in scroll_box.children_map:
                no_label = MDLabel(
                    text="No player online. You can type any username to ban.",
                    halign="center",
                    theme_text_color="Custom",
                    text_color=(1, 1, 1, 0.7),
                    size_hint_y=None,
                    height="40dp"
                )
                scroll_box.children_map["no_player"] = no_label
                scroll_box.add_widget(no_label)

    def on_search_all_text(self, instance, value):
        # Instant filtering while typing
        self.update_left_panel_ui(value)

    # ==================== RIGHT PANEL (Banned Players) ====================
    def load_banned_players_threaded(self):
        threading.Thread(target=self.load_banned_players, daemon=True).start()

    def load_banned_players(self):
        with self._lock:
            banned_players = []
            banned_file = os.path.join(self.server_path, "banned-players.json")
            banned_ips_file = os.path.join(self.server_path, "banned-ips.json")

            if os.path.exists(banned_file):
                try:
                    with open(banned_file, "r") as f:
                        data = json.load(f)
                        for p in data:
                            if isinstance(p, dict) and "name" in p:
                                banned_players.append(p["name"])
                            elif isinstance(p, str):
                                banned_players.append(p)
                except:
                    pass

            if os.path.exists(banned_ips_file):
                try:
                    with open(banned_ips_file, "r") as f:
                        data = json.load(f)
                        banned_players.extend(data)
                except:
                    pass

            self._banned_players = banned_players
            search_text = self.ids.get("search_banned").text if self.ids.get("search_banned") else ""
            Clock.schedule_once(lambda dt: self.update_banned_panel_ui(search_text))

    def update_banned_panel_ui(self, search_text=""):
        scroll_box = self.ids.get("banned_players_list")
        if not scroll_box:
            return

        if not hasattr(scroll_box, "children_map"):
            scroll_box.children_map = {}

        filtered = [p for p in self._banned_players if search_text.lower() in p.lower()]

        # Remove cards no longer in filtered
        for key in list(scroll_box.children_map.keys()):
            if key not in filtered and key != "no_player":
                scroll_box.remove_widget(scroll_box.children_map[key])
                del scroll_box.children_map[key]

        if filtered:
            for player in filtered:
                if player not in scroll_box.children_map:
                    card = self.create_player_card(player, ban=False)
                    scroll_box.children_map[player] = card
                    scroll_box.add_widget(card)
            if "no_player" in scroll_box.children_map:
                scroll_box.remove_widget(scroll_box.children_map["no_player"])
                del scroll_box.children_map["no_player"]
        else:
            if "no_player" not in scroll_box.children_map:
                no_label = MDLabel(
                    text="No banned player found.",
                    halign="center",
                    theme_text_color="Custom",
                    text_color=(1, 1, 1, 0.7),
                    size_hint_y=None,
                    height="40dp"
                )
                scroll_box.children_map["no_player"] = no_label
                scroll_box.add_widget(no_label)

    def on_search_banned_text(self, instance, value):
        # Instant filtering while typing
        self.update_banned_panel_ui(value)

    # ==================== PLAYER CARD CREATION ====================
    def create_player_card(self, player, ban=True):
        skin_url = f"https://minotar.net/helm/{player}/64"
        card = MDCard(
            orientation="horizontal",
            size_hint_y=None,
            height="80dp",
            padding="10dp",
            spacing="15dp",
            radius=[12],
            md_bg_color=(0.95, 0.95, 0.97, 1),
            ripple_behavior=True,
        )

        img = FitImage(source=skin_url, size_hint=(None, None), size=("56dp", "56dp"))
        name_label = MDLabel(
            text=player,
            halign="left",
            valign="center",
            font_style="H6",
            theme_text_color="Custom",
            text_color=(0.1, 0.1, 0.1, 1),
            size_hint_x=1,
        )

        card.add_widget(img)
        card.add_widget(name_label)

        btn = MDRaisedButton(
            text="Ban" if ban else "Unban",
            md_bg_color=(0.8, 0.1, 0.1, 1) if ban else (0.6, 0.1, 0.1, 1),
            text_color=(1, 1, 1, 1),
            size_hint=(None, None),
            size=("70dp", "40dp"),
            on_release=lambda x, p=player: self.ban_user_global(p) if ban else self.unban_player(p)
        )
        card.add_widget(btn)
        return card

    # ==================== BAN / UNBAN ====================
    def ban_user_global(self, username):
        def _ban():
            banned_file = os.path.join(self.server_path, "banned-players.json")
            banned_players = self._banned_players.copy()

            if username not in banned_players:
                banned_players.append(username)

            with open(banned_file, "w") as f:
                json.dump(banned_players, f, indent=2)

            # Update in-memory list
            self._banned_players = banned_players
            # Refresh right panel instantly
            Clock.schedule_once(lambda dt: self.update_banned_panel_ui(self.ids.get("search_banned").text))

        threading.Thread(target=_ban, daemon=True).start()

    def unban_player(self, username):
        def _unban():
            banned_file = os.path.join(self.server_path, "banned-players.json")
            banned_players = self._banned_players.copy()

            if username in banned_players:
                banned_players.remove(username)

            with open(banned_file, "w") as f:
                json.dump(banned_players, f, indent=2)

            # Update in-memory list
            self._banned_players = banned_players
            # Refresh right panel instantly
            Clock.schedule_once(lambda dt: self.update_banned_panel_ui(self.ids.get("search_banned").text))

        threading.Thread(target=_unban, daemon=True).start()
class Server_Whitelist(MDScreen):
    server_path = ""
    _refresh_event = None
    _lock = threading.Lock()
    _whitelisted_players = []

    def on_enter(self):
        self.attach_to_server()
        if self._refresh_event is None:
            self._refresh_event = Clock.schedule_interval(self._refresh_data, 3)

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None

    def set_screen(self, screen):
        self.manager.current = screen

    def attach_to_server(self):
        try:
            server_status_screen = self.manager.get_screen("status")
            self.server_path = Server_Status.get_server_log_info(server_status_screen)
            self.load_whitelisted_players_threaded()
            self.check_whitelist_status()
        except Exception as e:
            print(f"Error attaching to server: {e}")

    def _refresh_data(self, dt):
        if self.manager.current == "whitelist":
            self.load_whitelisted_players_threaded()
            self.check_whitelist_status()

    # --------------------- Check whitelist toggle ---------------------
    def check_whitelist_status(self):
        status_label = self.ids.get("whitelist_status")
        if not status_label:
            return
        properties_path = os.path.join(self.server_path, "server.properties")
        whitelist_on = True
        if os.path.exists(properties_path):
            try:
                with open(properties_path, "r") as f:
                    for line in f:
                        if line.startswith("white-list=") or line.startswith("whitelist="):
                            value = line.strip().split("=")[-1].lower()
                            whitelist_on = (value == "true")
                            break
            except Exception as e:
                print(f"Error reading server.properties: {e}")
        status_label.text = "" if whitelist_on else "Whitelist is turned OFF"

    # ==================== RIGHT PANEL ====================
    def load_whitelisted_players_threaded(self):
        threading.Thread(target=self.load_whitelisted_players, daemon=True).start()

    def load_whitelisted_players(self):
        with self._lock:
            whitelist_file = os.path.join(self.server_path, "whitelist.json")
            players = []
            if os.path.exists(whitelist_file):
                try:
                    with open(whitelist_file, "r") as f:
                        data = json.load(f)
                        for p in data:
                            if isinstance(p, dict) and "name" in p:
                                players.append(p["name"])
                            elif isinstance(p, str):
                                players.append(p)
                except Exception as e:
                    print(f"Failed to read whitelist.json: {e}")
            self._whitelisted_players = players
            search_text = self.ids.get("search_whitelist").text if self.ids.get("search_whitelist") else ""
            Clock.schedule_once(lambda dt: self.update_whitelist_panel_ui(search_text))

    def update_whitelist_panel_ui(self, search_text=""):
        scroll_box = self.ids.get("whitelisted_players_list")
        if not scroll_box:
            return
        if not hasattr(scroll_box, "children_map"):
            scroll_box.children_map = {}

        filtered = [p for p in self._whitelisted_players if search_text.lower() in p.lower()]

        # remove old
        for key in list(scroll_box.children_map.keys()):
            if key not in filtered and key != "no_player":
                scroll_box.remove_widget(scroll_box.children_map[key])
                del scroll_box.children_map[key]

        if filtered:
            for player in filtered:
                if player not in scroll_box.children_map:
                    card = self.create_player_card(player)
                    scroll_box.children_map[player] = card
                    scroll_box.add_widget(card)
            if "no_player" in scroll_box.children_map:
                scroll_box.remove_widget(scroll_box.children_map["no_player"])
                del scroll_box.children_map["no_player"]
        else:
            if "no_player" not in scroll_box.children_map:
                no_label = MDLabel(
                    text="No whitelisted players found.",
                    halign="center",
                    theme_text_color="Custom",
                    text_color=(1, 1, 1, 0.7),
                    size_hint_y=None,
                    height="40dp"
                )
                scroll_box.children_map["no_player"] = no_label
                scroll_box.add_widget(no_label)

    def on_search_whitelist_text(self, instance, value):
        self.update_whitelist_panel_ui(value)

    # ==================== PLAYER CARD CREATION ====================
    def create_player_card(self, player):
        skin_url = f"https://minotar.net/helm/{player}/64"
        card = MDCard(
            orientation="horizontal",
            size_hint_y=None,
            height="80dp",
            padding="10dp",
            spacing="15dp",
            radius=[12],
            md_bg_color=(0.16, 0.16, 0.18, 1),  # dark card background
            ripple_behavior=True,
        )

        img = FitImage(source=skin_url, size_hint=(None, None), size=("56dp", "56dp"))
        name_label = MDLabel(
            text=player,
            halign="left",
            valign="center",
            font_style="H6",
            theme_text_color="Custom",
            text_color=(1, 1, 1, 1),  # white text
            size_hint_x=1,
        )

        card.add_widget(img)
        card.add_widget(name_label)

        btn = MDRaisedButton(
            text="Remove",
            md_bg_color=(0.8, 0.1, 0.1, 1),  # red button
            text_color=(1, 1, 1, 1),  # white text
            size_hint=(None, None),
            size=("90dp", "40dp"),
            on_release=lambda x, p=player: self.remove_from_whitelist(p)
        )
        card.add_widget(btn)
        return card

    # ==================== ADD / REMOVE ====================
    def add_to_whitelist(self, username):
        def _add():
            whitelist_file = os.path.join(self.server_path, "whitelist.json")
            players = self._whitelisted_players.copy()
            if username and username not in players:
                players.append(username)
            with open(whitelist_file, "w") as f:
                json.dump(players, f, indent=2)
            self._whitelisted_players = players
            Clock.schedule_once(lambda dt: self.update_whitelist_panel_ui(self.ids.get("search_whitelist").text))
        threading.Thread(target=_add, daemon=True).start()

    def remove_from_whitelist(self, username):
        def _remove():
            whitelist_file = os.path.join(self.server_path, "whitelist.json")
            players = self._whitelisted_players.copy()
            if username in players:
                players.remove(username)
            with open(whitelist_file, "w") as f:
                json.dump(players, f, indent=2)
            self._whitelisted_players = players
            Clock.schedule_once(lambda dt: self.update_whitelist_panel_ui(self.ids.get("search_whitelist").text))
        threading.Thread(target=_remove, daemon=True).start()
class Server_Ops(MDScreen):
    server_path = ""
    _refresh_event = None
    _lock = threading.Lock()
    _ops_players = []

    def on_enter(self):
        self.attach_to_server()
        if self._refresh_event is None:
            self._refresh_event = Clock.schedule_interval(self._refresh_data, 3)

    def on_leave(self):
        if self._refresh_event:
            self._refresh_event.cancel()
            self._refresh_event = None

    def set_screen(self, screen):
        self.manager.current = screen

    def attach_to_server(self):
        try:
            server_status_screen = self.manager.get_screen("status")
            self.server_path = Server_Status.get_server_log_info(server_status_screen)
            self.load_ops_players_threaded()
        except Exception as e:
            print(f"Error attaching to server: {e}")

    def _refresh_data(self, dt):
        if self.manager.current == "ops":
            self.load_ops_players_threaded()

    # ==================== LOAD OPS ====================
    def load_ops_players_threaded(self):
        threading.Thread(target=self.load_ops_players, daemon=True).start()

    def load_ops_players(self):
        with self._lock:
            ops_file = os.path.join(self.server_path, "ops.json")
            players = []
            if os.path.exists(ops_file):
                try:
                    with open(ops_file, "r") as f:
                        data = json.load(f)
                        for p in data:
                            if isinstance(p, dict) and "name" in p:
                                players.append(p["name"])
                            elif isinstance(p, str):
                                players.append(p)
                except Exception as e:
                    print(f"Failed to read ops.json: {e}")
            self._ops_players = players
            search_text = self.ids.get("search_ops").text if self.ids.get("search_ops") else ""
            Clock.schedule_once(lambda dt: self.update_ops_panel_ui(search_text))

    def update_ops_panel_ui(self, search_text=""):
        scroll_box = self.ids.get("ops_players_list")
        if not scroll_box:
            return
        if not hasattr(scroll_box, "children_map"):
            scroll_box.children_map = {}

        filtered = [p for p in self._ops_players if search_text.lower() in p.lower()]

        # remove old
        for key in list(scroll_box.children_map.keys()):
            if key not in filtered and key != "no_player":
                scroll_box.remove_widget(scroll_box.children_map[key])
                del scroll_box.children_map[key]

        if filtered:
            for player in filtered:
                if player not in scroll_box.children_map:
                    card = self.create_player_card(player)
                    scroll_box.children_map[player] = card
                    scroll_box.add_widget(card)
            if "no_player" in scroll_box.children_map:
                scroll_box.remove_widget(scroll_box.children_map["no_player"])
                del scroll_box.children_map["no_player"]
        else:
            if "no_player" not in scroll_box.children_map:
                no_label = MDLabel(
                    text="No operators found.",
                    halign="center",
                    theme_text_color="Custom",
                    text_color=(1, 1, 1, 0.7),
                    size_hint_y=None,
                    height="40dp"
                )
                scroll_box.children_map["no_player"] = no_label
                scroll_box.add_widget(no_label)

    def on_search_ops_text(self, instance, value):
        self.update_ops_panel_ui(value)

    # ==================== PLAYER CARD CREATION ====================
    def create_player_card(self, player):
        skin_url = f"https://minotar.net/helm/{player}/64"
        card = MDCard(
            orientation="horizontal",
            size_hint_y=None,
            height="80dp",
            padding="10dp",
            spacing="15dp",
            radius=[12],
            md_bg_color=(0.16, 0.16, 0.18, 1),
            ripple_behavior=True,
        )

        img = FitImage(source=skin_url, size_hint=(None, None), size=("56dp", "56dp"))
        name_label = MDLabel(
            text=player,
            halign="left",
            valign="center",
            font_style="H6",
            theme_text_color="Custom",
            text_color=(1, 1, 1, 1),
            size_hint_x=1,
        )

        card.add_widget(img)
        card.add_widget(name_label)

        btn = MDRaisedButton(
            text="Remove",
            md_bg_color=(0.8, 0.1, 0.1, 1),
            text_color=(1, 1, 1, 1),
            size_hint=(None, None),
            size=("90dp", "40dp"),
            on_release=lambda x, p=player: self.remove_op(p)
        )
        card.add_widget(btn)
        return card

    # ==================== ADD / REMOVE OPS ====================
    def add_op(self, username):
        def _add():
            ops_file = os.path.join(self.server_path, "ops.json")
            players = self._ops_players.copy()
            if username and username not in players:
                players.append(username)
            with open(ops_file, "w") as f:
                json.dump(players, f, indent=2)
            self._ops_players = players
            Clock.schedule_once(lambda dt: self.update_ops_panel_ui(self.ids.get("search_ops").text))
        threading.Thread(target=_add, daemon=True).start()

    def remove_op(self, username):
        def _remove():
            ops_file = os.path.join(self.server_path, "ops.json")
            players = self._ops_players.copy()
            if username in players:
                players.remove(username)
            with open(ops_file, "w") as f:
                json.dump(players, f, indent=2)
            self._ops_players = players
            Clock.schedule_once(lambda dt: self.update_ops_panel_ui(self.ids.get("search_ops").text))
        threading.Thread(target=_remove, daemon=True).start()
# --------------------------
# Custom File List Item
# ----------------------------
class FileManagerItem(OneLineAvatarIconListItem):
    is_folder = BooleanProperty(False)
    path = StringProperty("")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.register_event_type('on_selection_change')
        # Default text color (yellow for all)
        self._lbl_color = 1, 1, 0, 1

    def on_selection_change(self, selected):
        """Highlight item if selected, transparent if not."""
        self.bg_color = [0.2, 0.4, 0.8, 0.3] if selected else (0, 0, 0, 0)


# ----------------------------
# File Manager Screen
# ----------------------------
class Server_File(MDScreen):
    current_path = StringProperty(os.path.expanduser("~"))
    selected_paths = ListProperty([])
    _clipboard = ListProperty([])
    DOUBLE_CLICK_INTERVAL = 0.35  # seconds
    server_root = StringProperty("")
    last_click_time = {}

    # ------------------------
    # Lifecycle
    # ------------------------
    def on_enter(self, *args):
        self.attach_to_server()
        Window.bind(on_keyboard=self.on_key)
        self.update_tab_colors(self.manager.current)
    def on_leave(self, *args):
        Window.unbind(on_keyboard=self.on_key)

    def set_screen(self, screen_name):
        # Switch screen
        self.manager.current = screen_name
        # Update bottom tab colors
        self.update_tab_colors(screen_name)

    def update_tab_colors(self, active_screen):
        # Default = white
        inactive_color = (1, 1, 1, 1)
        active_color = (0.25, 0.5, 1, 1)

        # Reset all tabs to white
        self.ids.tab_status.text_color = inactive_color
        self.ids.tab_players.text_color = inactive_color
        self.ids.tab_console.text_color = inactive_color
        self.ids.tab_logs.text_color = inactive_color
        self.ids.tab_props.text_color = inactive_color
        self.ids.tab_home.text_color = inactive_color

        # Set active tab color
        if active_screen == "status":
            self.ids.tab_status.text_color = active_color
        elif active_screen == "players":
            self.ids.tab_players.text_color = active_color
        elif active_screen == "console":
            self.ids.tab_console.text_color = active_color
        elif active_screen == "server_file":
            self.ids.tab_logs.text_color = active_color
        elif active_screen == "server_properties":
            self.ids.tab_props.text_color = active_color
        elif active_screen == "homescreen":
            self.ids.tab_home.text_color = active_color
    # ------------------------
    # Server Attachment
    # ------------------------
    def attach_to_server(self):
        """Attach the file manager to the server path, fallback to home."""
        try:
            server_status_screen = self.manager.get_screen("status")
            self.current_path = Server_Status.get_server_log_info(server_status_screen)
            self.server_path = self.current_path
        except Exception:
            self.current_path = os.path.expanduser("~")
        finally:
            self.load_files()

    # ------------------------
    # Load Files
    # ------------------------
    def load_files(self):
        self.selected_paths = []
        folders, files = [], []

        try:
            for item in os.listdir(self.current_path):
                full_path = os.path.join(self.current_path, item)
                if os.path.isdir(full_path):
                    folders.append({"text": item, "path": full_path, "is_folder": True})
                else:
                    files.append({"text": item, "path": full_path, "is_folder": False})
        except PermissionError:
            self.log_message("Permission Denied.")
            self.go_back()
            return
        except Exception as e:
            self.log_message(f"Error reading directory: {e}")
            return

        folders.sort(key=lambda x: x['text'].lower())
        files.sort(key=lambda x: x['text'].lower())

        self.ids.file_list.data = [
            {"viewclass": "FileManagerItem", "text": item['text'], "path": item['path'], "is_folder": item['is_folder']}
            for item in folders + files
        ]

    # ------------------------
    # User Interaction
    # ------------------------
    def item_released(self, item):
        current_time = time.time()
        last_time = self.last_click_time.get(item.path, 0)
        time_diff = current_time - last_time
        is_double_click = time_diff <= self.DOUBLE_CLICK_INTERVAL
        self.last_click_time[item.path] = current_time

        for child in self.ids.file_list.children[0].children:
            if getattr(child, "path", None) in self.selected_paths:
                child.dispatch('on_selection_change', False)

        self.selected_paths = [item.path]
        item.dispatch('on_selection_change', True)

        if is_double_click:
            if item.is_folder:
                self.current_path = item.path
                self.load_files()
            else:
                try:
                    webbrowser.open(item.path)
                except Exception as e:
                    self.log_message(f"Could not open file: {e}")

    def on_key(self, window, key, scancode, codepoint, modifier):
        if 'ctrl' in modifier:
            if codepoint == 'c':
                self._clipboard = list(self.selected_paths)
            elif codepoint == 'v':
                if not self._clipboard:
                    return
                self.do_copy(self._clipboard, self.current_path)

    # ------------------------
    # File Operations
    # ------------------------
    def go_back(self):
        current_abs = os.path.abspath(self.current_path)
        server_abs = os.path.abspath(self.server_path)

        if current_abs == server_abs:
            return

        parent_dir = os.path.abspath(os.path.dirname(current_abs))
        if os.path.commonpath([parent_dir, server_abs]) != server_abs:
            return

        self.current_path = parent_dir
        self.load_files()

    def do_delete(self):
        for path in self.selected_paths:
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
            except Exception as e:
                self.log_message(f"Error deleting {os.path.basename(path)}: {e}")
        self.load_files()

    def do_rename_item(self, old_path, new_name):
        if not new_name:
            return
        new_path = os.path.join(os.path.dirname(old_path), new_name)
        if os.path.exists(new_path):
            self.log_message(f"'{new_name}' already exists.")
            return
        try:
            os.rename(old_path, new_path)
        except Exception as e:
            self.log_message(f"Error renaming: {e}")
        self.load_files()

    def do_create_folder(self, folder_name):
        if not folder_name:
            return
        path = os.path.join(self.current_path, folder_name)
        try:
            if os.path.exists(path):
                self.log_message(f"'{folder_name}' already exists.")
                return
            os.makedirs(path)
        except Exception as e:
            self.log_message(f"Error creating folder: {e}")
        self.load_files()

    def do_copy(self, sources, destination_dir):
        for src_path in sources:
            base_name = os.path.basename(src_path)
            dest_path = os.path.join(destination_dir, base_name)
            counter = 1
            while os.path.exists(dest_path):
                name, ext = os.path.splitext(base_name)
                dest_path = os.path.join(destination_dir, f"{name}_copy_{counter}{ext}")
                counter += 1
            try:
                if os.path.isdir(src_path):
                    shutil.copytree(src_path, dest_path)
                else:
                    shutil.copy2(src_path, dest_path)
            except Exception as e:
                self.log_message(f"Error copying {base_name}: {e}")
        self.load_files()

    # ------------------------
    # Dialogs
    # ------------------------
    def create_folder_dialog(self):
        self.show_input_dialog("Create Folder", "Enter folder name", callback=self.do_create_folder)

    def rename_item_dialog(self):
        if len(self.selected_paths) != 1:
            return
        old_path = self.selected_paths[0]
        self.show_input_dialog("Rename Item", os.path.basename(old_path),
                               callback=lambda new_name: self.do_rename_item(old_path, new_name))

    def show_delete_confirmation(self):
        if not self.selected_paths:
            return
        self.show_confirmation_dialog(
            "Confirm Deletion",
            f"Delete {len(self.selected_paths)} item(s)? This is permanent.",
            on_confirm=self.do_delete
        )

    def import_files_dialog(self):
        self.log_message("Import function not implemented.")

    # ------------------------
    # Helpers
    # ------------------------
    def log_message(self, msg):
        self.ids.log_label.text = f"[ERROR] {msg}"

    def show_input_dialog(self, title, hint_text="", initial_text="", callback=None):
        dialog = MDDialog(
            title=title,
            type="custom",
            content_cls=MDTextField(hint_text=hint_text, text=initial_text),
            buttons=[
                MDFlatButton(text="CANCEL", on_release=lambda x: dialog.dismiss()),
                MDRaisedButton(text="OK", on_release=lambda x: (callback(dialog.content_cls.text), dialog.dismiss())),
            ],
        )
        dialog.open()

    def show_confirmation_dialog(self, title, text, on_confirm):
        dialog = MDDialog(
            title=title,
            text=text,
            buttons=[
                MDFlatButton(text="CANCEL", on_release=lambda x: dialog.dismiss()),
                MDRaisedButton(text="CONFIRM", on_release=lambda x: (on_confirm(), dialog.dismiss())),
            ],
        )
        dialog.open()

class Server_Properties(MDScreen):
    server_path = None
    original_props = {}
    unsaved_changes = False
    gamemode_menu = None
    difficulty_menu = None
    manager = ObjectProperty()

    # --- change card reference
    change_card = None

    def on_pre_enter(self, *args):
        self.get_serverpath()
        self.load_properties()
    def on_enter(self, *args):
        self.update_tab_colors(self.manager.current)
    def get_serverpath(self):
        try:
            status = self.manager.get_screen("status")
            self.server_path = (
                getattr(status, "server_path", None)
                or getattr(status, "server_folder", None)
                or os.getcwd()
            )
        except Exception:
            self.server_path = os.getcwd()

    # ---------------- safe helpers ----------------
    def _get_widget(self, wid):
        return self.ids.get(wid)

    def _get_active(self, wid):
        w = self._get_widget(wid)
        return bool(getattr(w, "active", False)) if w else False

    def _set_status_text(self, wid, enabled):
        sid = f"{wid}_status"
        lbl = self._get_widget(sid)
        if lbl:
            lbl.text = "Enabled" if enabled else "Disabled"

    def _safe_int(self, s, default=0):
        try:
            return max(0, int(s))
        except Exception:
            return default

    # ---------------- load / save ----------------
    def load_properties(self):
        props_file = os.path.join(self.server_path, "server.properties")
        props = {}
        if os.path.exists(props_file):
            try:
                with open(props_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if "=" in line:
                            k, v = line.strip().split("=", 1)
                            props[k] = v
            except Exception as e:
                print("Failed to load server.properties:", e)

        self.original_props = props.copy()

        def _bool_set(key, wid):
            val = props.get(key, "false").lower() == "true"
            w = self._get_widget(wid)
            if w:
                w.active = val
            self._set_status_text(wid, val)

        for key, wid in [
            ("allow-flight", "allow_flight"),
            ("allow-nether", "allow_nether"),
            ("enable-command-block", "enable_command_block"),
            ("enforce-whitelist", "enforce_whitelist"),
            ("force-gamemode", "force_gamemode"),
            ("generate-structures", "generate_structures"),
            ("hardcore", "hardcore"),
            ("hide-online-players", "hide_online_players"),
            ("online-mode", "online_mode"),
            ("pvp", "pvp"),
            ("spawn-monsters", "spawn_monsters"),
            ("white-list", "white_list"),
        ]:
            _bool_set(key, wid)

        if self._get_widget("gamemode"):
            self.ids.gamemode.text = props.get("gamemode", "survival")
        if self._get_widget("difficulty"):
            self.ids.difficulty.text = props.get("difficulty", "easy")

        if self._get_widget("max_players"):
            self.ids.max_players.text = props.get("max-players", "16")
        if self._get_widget("max_tick_time"):
            self.ids.max_tick_time.text = props.get("max-tick-time", "60000")
        if self._get_widget("max_world_size"):
            self.ids.max_world_size.text = props.get("max-world-size", "29999984")
        if self._get_widget("pause_when_empty"):
            self.ids.pause_when_empty.text = props.get(
                "pause-when-empty-seconds", "60"
            )
        if self._get_widget("player_idle_timeout"):
            self.ids.player_idle_timeout.text = props.get("player-idle-timeout", "0")
        if self._get_widget("spawn_protection"):
            self.ids.spawn_protection.text = props.get("spawn-protection", "16")

        self.unsaved_changes = False
        self._hide_change_card()

    def save_properties(self, *a, server_online=False, restart=False):
        new_props = self.original_props.copy()

        def _bool_save(key, wid):
            new_props[key] = str(self._get_active(wid)).lower()

        for key, wid in [
            ("allow-flight", "allow_flight"),
            ("allow-nether", "allow_nether"),
            ("enable-command-block", "enable_command_block"),
            ("enforce-whitelist", "enforce_whitelist"),
            ("force-gamemode", "force_gamemode"),
            ("generate-structures", "generate_structures"),
            ("hardcore", "hardcore"),
            ("hide-online-players", "hide_online_players"),
            ("online-mode", "online_mode"),
            ("pvp", "pvp"),
            ("spawn-monsters", "spawn_monsters"),
            ("white-list", "white_list"),
        ]:
            _bool_save(key, wid)

        new_props["gamemode"] = self.ids.gamemode.text.lower()
        new_props["difficulty"] = self.ids.difficulty.text.lower()

        new_props["max-players"] = self.ids.max_players.text
        new_props["max-tick-time"] = self.ids.max_tick_time.text
        new_props["max-world-size"] = self.ids.max_world_size.text
        new_props["pause-when-empty-seconds"] = self.ids.pause_when_empty.text
        new_props["player-idle-timeout"] = self.ids.player_idle_timeout.text
        new_props["spawn-protection"] = self.ids.spawn_protection.text

        props_file = os.path.join(self.server_path, "server.properties")
        try:
            with open(props_file, "w", encoding="utf-8") as f:
                for k, v in new_props.items():
                    f.write(f"{k}={v}\n")
        except Exception as e:
            print("Failed to save:", e)
            return

        self.original_props = new_props.copy()
        self.unsaved_changes = False
        self._hide_change_card()

        # If online and restart chosen → restart server
        if server_online and restart:
            try:
                server_status_screen = self.manager.get_screen("status")
                server_status_screen.restart_server()
                print("[INFO] Properties saved and server restarted.")
            except Exception as e:
                print("[ERROR] Failed to restart server:", e)

    # ---------------- UI change detection ----------------
    def mark_change(self, *a):
        if self.unsaved_changes:
            return
        self.unsaved_changes = True
        self._show_change_card("Unsaved changes detected")

    def discard_changes(self, *a):
        self.load_properties()

    # ---------------- bottom card ----------------
    def _show_change_card(self, message):
        if self.change_card:
            return

        # Load server status
        server_status = "Offline"
        server_info_path = os.path.join(self.server_path, "server_info.json")
        if os.path.exists(server_info_path):
            try:
                with open(server_info_path, "r", encoding="utf-8") as f:
                    info = json.load(f)
                    server_status = info.get("server_status", "Offline")
            except Exception as e:
                print("[ERROR] Failed to read server_info.json:", e)

        # Main card
        self.change_card = MDCard(
            orientation="vertical",
            size_hint=(0.9, None),
            height=dp(160 if server_status == "Online" else 140),
            md_bg_color=(0.15, 0.15, 0.18, 1),
            padding=dp(16),
            radius=[16, 16, 16, 16],
            elevation=10,
        )

        # Container
        box = MDBoxLayout(orientation="vertical", spacing=dp(16))

        # Top message
        box.add_widget(
            MDLabel(
                text=message,
                halign="center",
                theme_text_color="Custom",
                text_color=(1, 1, 1, 1),
                font_style="H6",
                size_hint_y=None,
                height=dp(40),
            )
        )

        # Restart checkbox row
        restart_checkbox = None
        if server_status == "Online":
            restart_checkbox = MDCheckbox(
                active=True,
                size_hint=(None, None),
                size=(dp(28), dp(28))
            )

            restart_label = MDLabel(
                text="Restart required",
                theme_text_color="Custom",
                text_color=(1, 0.8, 0.2, 1),
                halign="left",
                valign="center",
                size_hint_x=1,
            )

            row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(8),
                size_hint_y=None,
                height=dp(40),
                pos_hint={"center_x": 0.5},
            )
            row.add_widget(restart_checkbox)
            row.add_widget(restart_label)
            box.add_widget(row)

        # Buttons container
        btns = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(16),
            size_hint_y=None,
            height=dp(50),
            padding=[dp(8), 0, dp(8), 0],
        )

        btns.add_widget(
            MDFlatButton(
                text="Discard Changes",
                theme_text_color="Custom",
                text_color=(1, 0.3, 0.3, 1),
                font_style="Button",
                on_release=lambda x: self.discard_changes(),
            )
        )
        btns.add_widget(
            MDRaisedButton(
                text="Save Changes",
                md_bg_color=(0.2, 0.6, 1, 1),
                text_color=(1, 1, 1, 1),
                font_style="Button",
                on_release=lambda x: self.save_properties(
                    server_online=(server_status == "Online"),
                    restart=restart_checkbox.active if restart_checkbox else False,
                ),
            )
        )

        box.add_widget(btns)
        self.change_card.add_widget(box)

        # Position card at bottom
        self.change_card.pos_hint = {"center_x": 0.5, "y": 0.02}
        self.add_widget(self.change_card)

    def _hide_change_card(self):
        if self.change_card and self.change_card.parent:
            self.remove_widget(self.change_card)
        self.change_card = None

    def open_gamemode_menu(self, caller):
        if not self.gamemode_menu:
            items = [
                {
                    "viewclass": "OneLineListItem",
                    "text": gm,
                    "on_release": lambda x=gm: self.set_dropdown("gamemode", x),
                }
                for gm in ["survival", "creative", "adventure", "spectator"]
            ]
            self.gamemode_menu = MDDropdownMenu(caller=caller, items=items, width_mult=3)
        self.gamemode_menu.open()

    def open_difficulty_menu(self, caller):
        if not self.difficulty_menu:
            items = [
                {
                    "viewclass": "OneLineListItem",
                    "text": diff,
                    "on_release": lambda x=diff: self.set_dropdown("difficulty", x),
                }
                for diff in ["peaceful", "easy", "normal", "hard"]
            ]
            self.difficulty_menu = MDDropdownMenu(caller=caller, items=items, width_mult=3)
        self.difficulty_menu.open()

    def set_dropdown(self, wid, value):
        self.ids[wid].text = value
        if wid == "gamemode" and self.gamemode_menu:
            self.gamemode_menu.dismiss()
        if wid == "difficulty" and self.difficulty_menu:
            self.difficulty_menu.dismiss()
        self.mark_change()

    def set_screen(self, screen_name):
        # Switch screen
        self.manager.current = screen_name
        # Update bottom tab colors
        self.update_tab_colors(screen_name)

    def update_tab_colors(self, active_screen):
        # Default = white
        inactive_color = (1, 1, 1, 1)
        active_color = (0.25, 0.5, 1, 1)

        # Reset all tabs to white
        self.ids.tab_status.text_color = inactive_color
        self.ids.tab_players.text_color = inactive_color
        self.ids.tab_console.text_color = inactive_color
        self.ids.tab_logs.text_color = inactive_color
        self.ids.tab_props.text_color = inactive_color
        self.ids.tab_home.text_color = inactive_color

        # Set active tab color
        if active_screen == "status":
            self.ids.tab_status.text_color = active_color
        elif active_screen == "players":
            self.ids.tab_players.text_color = active_color
        elif active_screen == "console":
            self.ids.tab_console.text_color = active_color
        elif active_screen == "server_file":
            self.ids.tab_logs.text_color = active_color
        elif active_screen == "server_properties":
            self.ids.tab_props.text_color = active_color
        elif active_screen == "homescreen":
            self.ids.tab_home.text_color = active_color

    def adjust_value(self, wid, delta):
        """Increase or decrease a numeric text field value."""
        w = self._get_widget(wid)
        if not w:
            return
        try:
            val = int(w.text)
        except ValueError:
            val = 0
        val = max(0, val + delta)  # prevent negative
        w.text = str(val)
        self.mark_change()


# === Main App ===
class MainApp(MDApp):
    Window.maximize()
    max_ram = NumericProperty(0)
    def on_start(self):
        # ✅ Set icon here using .ico for Windows
        icon_path = os.path.join("Icon", "logo.ico")  # make sure this exists
        if os.path.exists(icon_path):
            try:
                Window.set_icon(icon_path)
            except Exception as e:
                print(f"Failed to set icon: {e}")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.server_data = {
            "server_type": None,
            "version": None,
            "server_name": None,
            "ram": None,
        }

    def build(self):
        #set the kv_dir
        kv_dir = "design_files"
        # Load all KV files
        Builder.load_file(os.path.join(kv_dir, "setup.kv"))
        Builder.load_file(os.path.join(kv_dir, "status.kv"))
        Builder.load_file(os.path.join(kv_dir, "players.kv"))
        Builder.load_file(os.path.join(kv_dir, "server_file.kv"))
        Builder.load_file(os.path.join(kv_dir, "console.kv"))
        Builder.load_file(os.path.join(kv_dir, "properties.kv"))
        Builder.load_file(os.path.join(kv_dir,"versions.kv"))
        Builder.load_file(os.path.join(kv_dir, "home_screen.kv"))
        Builder.load_file(os.path.join(kv_dir, "server_type.kv"))
        Builder.load_file(os.path.join(kv_dir, "configuration.kv"))
        Builder.load_file(os.path.join(kv_dir, "customization.kv"))
        Builder.load_file(os.path.join(kv_dir, "whitelist.kv"))
        Builder.load_file(os.path.join(kv_dir, "banned_players.kv"))
        Builder.load_file(os.path.join(kv_dir, "ops.kv"))


        # Screen Manager
        sm = ScreenManager(transition=NoTransition())
        sm.add_widget(Server_Status(name="status"))
        sm.add_widget(Server_File(name="server_file"))
        sm.add_widget(Server_Console(name="console"))
        sm.add_widget(Server_Players(name="players"))
        sm.add_widget(Server_Properties(name="server_properties"))
        sm.add_widget(Home_Screen(name="homescreen"))
        sm.add_widget(Setup(name="setup"))
        sm.add_widget(Java_detection(name="java_detection"))
        sm.add_widget(Server_Folder(name="select_server_folder"))
        sm.add_widget(Server_Type(name="select_server_type"))
        sm.add_widget(Server_Version(name="select_server_version"))
        sm.add_widget(Configuration(name="config"))
        sm.add_widget(Server_name_and_ram(name="name_and_ram"))
        sm.add_widget(Finalize_Server(name="finalize"))
        sm.add_widget(Finish_Server(name="finish"))
        sm.add_widget(Server_customization(name="customization"))
        sm.add_widget(Server_Whitelist(name="whitelist"))
        sm.add_widget(Banned_Players(name="banned_players"))
        sm.add_widget(Server_Ops(name="ops"))

        # Check setup file
        config_path = "config.json"
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                try:
                    config = json.load(f)
                except json.JSONDecodeError:
                    config = {"setup": False}  # reset if corrupted

            if config.get("setup", False):  # if "setup": true
                home_screen = sm.get_screen("homescreen")
                home_screen.on_pre_enter()
                sm.current = "homescreen"
            else:  # if "setup": false
                Builder.load_file(os.path.join(kv_dir,"setup.kv"))
                sm.current = "setup"

        else:
            # Create default config.json if not exists
            config = {"setup": False}
            with open(config_path, "w") as f:
                json.dump(config, f, indent=4)

            sm.current = "setup"
        return sm


if __name__ == "__main__":
    MainApp().run()

# TODO adjust things on the logs on both file and and screen||make use of the java path||add backup system||add comment||
#TODO make sure that buttons on all screens have thier own thing to be disabled and started ||make that if 1 server is online the other servers menu cannot be opend
