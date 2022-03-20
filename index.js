/* Populate the list of mods and texture packs */
Promise.all([
  fetch(
    "https://raw.githubusercontent.com/nacrt/SkyblockClient-REPO/main/files/mods.json"
  ),
  fetch(
    "https://raw.githubusercontent.com/nacrt/SkyblockClient-REPO/main/files/packs.json"
  ),
])
  .then(([modsResp, packsResp]) => {
    return Promise.all([modsResp.json(), packsResp.json()]);
  })
  .then(([mods, packs]) => {
    const transformer = (item, hosting) => ({
      name: item.display,
      id: item.id,
      description: item.description,
      icon:
        "https://raw.githubusercontent.com/nacrt/SkyblockClient-REPO/main/files/icons/" +
        item.icon,
      downloadLink: item?.url || hosting + item.file,
      downloadAs: item.file,
      bundledItems: item?.packages,
      bundledConfig: item?.files,
      hide: item?.hidden,
      enabled: item?.enabled,
    });
    window.listMods = mods.map((item) =>
      transformer(
        item,
        "https://raw.githubusercontent.com/nacrt/SkyblockClient-REPO/main/files/mods/"
      )
    );
    window.listPacks = packs.map((item) =>
      transformer(
        item,
        "https://raw.githubusercontent.com/nacrt/SkyblockClient-REPO/main/files/packs/"
      )
    );
    const renderItem = (item) => {
      if (item.hide) return;
      const itemElement = document.createElement("li");
      itemElement.title = item.description;
      itemElement.className = "whitespace-nowrap overflow-hidden text-ellipsis";
      itemElement.innerHTML = `
        <label>
          <input
            type="checkbox" class="checkbox" data-id="${item.id}"
            ${item.enabled ? "checked" : ""}>
          <img class="inline-block max-h-4" src="${item.icon}">
          <strong>${item.name}</strong> - ${item.description}
        </label>
      `;
      return itemElement;
    };
    for (const item of window.listMods) {
      const itemElement = renderItem(item);
      if (!itemElement) continue;
      document.getElementById("modSpace").appendChild(itemElement);
    }
    for (const item of window.listPacks) {
      const itemElement = renderItem(item);
      if (!itemElement) continue;
      document.getElementById("packSpace").appendChild(itemElement);
    }
  });

/* Directory chooser */
if (window.showDirectoryPicker) {
  document.querySelector("#unsupportedWarning").classList.add("hidden");
  document.querySelector("#dropSpace").addEventListener(
    "dragover",
    (e) => {
      e.preventDefault();
    },
    false
  );
  document.querySelector("#dropSpace").addEventListener("drop", async (e) => {
    e.preventDefault();
    const directory = e.dataTransfer.items[0];
    window.baseHandle = await directory.getAsFileSystemHandle();
    startInstall();
  });
  document.querySelector("#dropSpace").addEventListener("click", async () => {
    window.baseHandle = await window.showDirectoryPicker();
    startInstall();
  });
} else {
  document.querySelector("#dropSpace").classList.add("opacity-20");
  document.querySelector("#dropSpace").classList.add("cursor-not-allowed");
}

/* Launcher info for MultiMC */
[
  document.querySelector("#vanillaRadio"),
  document.querySelector("#multimcRadio"),
].forEach((element) => {
  element.addEventListener("change", () => {
    if (document.querySelector("#multimcRadio").checked) {
      document.querySelector("#launcherInfo").classList.remove("hidden");
      document.querySelector("#multimcFinishInfo").classList.remove("hidden");
      document.querySelector("#multimcFinishInfo").classList.add("inline-block");
      document.querySelector("#vanillaFinishInfo").classList.add("hidden");
    } else {
      document.querySelector("#launcherInfo").classList.add("hidden");
      document.querySelector("#multimcFinishInfo").classList.add("hidden");
      document.querySelector("#multimcFinishInfo").classList.remove("inline-block");
      document.querySelector("#vanillaFinishInfo").classList.remove("hidden");
    }
  });
});

/* Transition between screens */
document.querySelector("#loadingScreen").classList.remove("hidden");
setTimeout(() => {
  document.querySelector("#loadingScreen").classList.add("hidden");
  document.querySelector("#configScreen").classList.remove("hidden");
}, 1000);
const startInstall = () => {
  if (!window.baseHandle) {
    alert("Hol up... No directory selected!");
    return;
  }
  if (window.baseHandle.kind != "directory") {
    alert("Hol up... That's not a directory!");
    return;
  }
  if (window.baseHandle.name != ".minecraft") {
    alert("Hol up... That's not the .minecraft directory!");
    return;
  }
  document.querySelector("#configScreen").classList.add("hidden");
  document.querySelector("#warningScreen").classList.remove("hidden");
};
document.querySelector("#installButton").addEventListener("click", () => {
  document.querySelector("#warningScreen").classList.add("hidden");
  document.querySelector("#progressScreen").classList.remove("hidden");
  install();
});

/* Actually install */
const logToProgressLog = (message) => {
  const progressElement = document.querySelector("#progressLog");
  progressElement.innerHTML +=
    "<strong>" + new Date().toLocaleTimeString() + "</strong> - " + message + "\n";
};
const writeFile = async (path, data) => {
  logToProgressLog(`Writing ${path}`);
  try {
    let currentContext = window.baseHandle;
    let remainingPath = path;
    while (remainingPath.length > 0) {
      if (remainingPath.includes("/")) {
        // if it's a directory, use .getDirectoryHandle(dir, { create: true })
        const dir = remainingPath.substring(0, remainingPath.indexOf("/"));
        currentContext = await currentContext.getDirectoryHandle(dir, { create: true });
        remainingPath = remainingPath.substring(remainingPath.indexOf("/") + 1);
      } else {
        // if it's a file, use .getFileHandle(file, { create: true })
        currentContext = await currentContext.getFileHandle(remainingPath, {
          create: true,
        });
        const writableFile = await currentContext.createWritable();
        await writableFile.write(data);
        await writableFile.close();
        logToProgressLog(`Wrote ${path}`);
        return;
      }
    }
  } catch (e) {
    console.error(e);
    logToProgressLog(`Failed to write ${path}`);
    alert(
      "There was an error trying to write a file. Try closing and reopening the page, then browsing instead of using drag and drop."
    );
  }
};
const downloadFile = async (url, fallbackName) => {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/octet-stream" },
    });
    const data = await response.arrayBuffer();
    return data;
  } catch (e) {
    try {
      if (!fallbackName) throw e;
      logToProgressLog("Using proxy due to CORS");
      const encodedName = encodeURIComponent(fallbackName);
      const encodedURL = encodeURIComponent(url.split("//")[1]);
      return await downloadFile(
        `https://cloudclient-proxy.ktibow.repl.co/mod?file=${encodedName}&url=${encodedURL}`
      );
    } catch (proxyE) {
      console.error(proxyE);
      alert(`There was an error trying to download ${url}.`);
      return;
    }
  }
};
const install = async () => {
  if (document.querySelector("#vanillaRadio").checked) {
    // Install Forge
    logToProgressLog("Downloading Forge");
    const forgeJar = await downloadFile(
      "https://raw.githubusercontent.com/nacrt/SkyblockClient-REPO/main/files/forge/forge-1.8.9-11.15.1.2318-1.8.9.jar"
    );
    const forgeJSON = await downloadFile(
      "https://raw.githubusercontent.com/nacrt/SkyblockClient-REPO/main/files/forge/1.8.9-forge1.8.9-11.15.1.2318-1.8.9.json"
    );
    await writeFile(
      "libraries/net/minecraftforge/forge/1.8.9-11.15.1.2318-1.8.9/forge-1.8.9-11.15.1.2318-1.8.9.jar",
      forgeJar
    );
    await writeFile(
      "versions/1.8.9-forge1.8.9-11.15.1.2318-1.8.9/1.8.9-forge1.8.9-11.15.1.2318-1.8.9.json",
      forgeJSON
    );
    window.dirHandle = await window.baseHandle.getDirectoryHandle("skyclient", {
      create: true,
    });
  } else {
    window.dirHandle = window.baseHandle;
  }
  logToProgressLog("Cleaning old mods/packs");
  ["mods", "resourcepacks", "config"].forEach(async (name) => {
    try {
      await window.dirHandle.removeEntry(name, { recursive: true, force: true });
    } catch (e) {
      console.error(e);
    }
  });
  const modBase = document.querySelector("#vanillaRadio").checked
    ? "skyclient/mods/"
    : "mods/";
  const packBase = document.querySelector("#vanillaRadio").checked
    ? "skyclient/resourcepacks/"
    : "resourcepacks/";
  const configBase = document.querySelector("#vanillaRadio").checked
    ? "skyclient/"
    : "";
  // Put the mods together, including dependencies
  const modList = [];
  for (const mod of window.listMods) {
    if (mod.hide) continue;
    if (!document.querySelector(`[data-id="${mod.id}"]`).checked) continue;
    modList.push({
      url: mod.downloadLink,
      name: mod.downloadAs,
      extras: mod.bundledConfig,
    });
    if (mod.bundledItems) {
      mod.bundledItems.forEach((id) => {
        const bundledMod = window.listMods.find((mod) => mod.id == id);
        modList.push({ url: bundledMod.downloadLink, name: bundledMod.downloadAs });
      });
    }
  }
  const packList = window.listPacks
    .filter((pack) => {
      if (pack.hide) return false;
      return document.querySelector(`[data-id="${pack.id}"]`).checked;
    })
    .map((pack) => ({ url: pack.downloadLink, name: pack.downloadAs }));
  // Download and install the mods
  for (const mod of modList) {
    logToProgressLog(`Downloading ${mod.name}`);
    const modFile = await downloadFile(mod.url, mod.name);
    await writeFile(modBase + mod.name, modFile);
    if (mod.extras) {
      for (const extra of mod.extras) {
        const extraPath = extra.replace(/\/.+\//g, "/");
        const extraFile = await downloadFile(
          `https://raw.githubusercontent.com/nacrt/SkyblockClient-REPO/main/files/${extraPath}`
        );
        await writeFile(configBase + extra, extraFile);
      }
    }
  }
  // Download and install the packs
  for (const pack of packList) {
    logToProgressLog(`Downloading ${pack.name}`);
    const packFile = await downloadFile(pack.url, pack.name);
    await writeFile(packBase + pack.name, packFile);
  }
  // Finish up
  confetti({
    particleCount: 300,
    spread: 100,
    decay: 0.95,
    origin: { y: 1 },
  });
  document.querySelector("#progressScreen").classList.add("hidden");
  document.querySelector("#finishScreen").classList.remove("hidden");
};
