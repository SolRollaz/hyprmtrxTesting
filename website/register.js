// js/register.js

document.addEventListener("DOMContentLoaded", () => {
  const gameName = new URLSearchParams(location.search).get("gameName") || localStorage.getItem("gameName");
  if (gameName) {
    const input = document.getElementById("game_name");
    input.value = gameName;
    input.readOnly = true;
    input.style.backgroundColor = "#222";
    input.style.color = "#ffd700";
    input.style.fontWeight = "bold";
    localStorage.setItem("gameName", gameName);
  }

  const form = document.getElementById("gameRegistrationForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const jwt = sessionStorage.getItem("jwt");
    if (!jwt) {
      alert("⚠️ You must authenticate with Web3 first.");
      return;
    }
    form.querySelector("button[type='submit']").disabled = true;
    await submitGameRegistration(jwt);
  });
});

async function submitGameRegistration(jwt) {
  const form = document.getElementById("gameRegistrationForm");
  const formData = new FormData();
  let valid = true;

  [...form.elements].forEach(el => el.style.border = "");

  const highlight = (el) => {
    el.style.border = "2px solid red";
    valid = false;
  };

  const gameName = form.game_name.value.trim();
  const engine = form.game_engine.value.trim();
  const desc = form.description.value.trim();
  const tokens = form.accepted_tokens.value.trim();
  const minVolume = form.min_liquidity_volume.value;
  const networks = Array.from(form.networks.selectedOptions).map(opt => opt.value);
  const platforms = Array.from(form.game_platforms.selectedOptions).map(opt => opt.value);
  const logoFile = form.game_logo.files[0];
  const bannerFile = form.game_banner.files[0];

  if (!gameName) highlight(form.game_name);
  if (!engine) highlight(form.game_engine);
  if (!desc) highlight(form.description);
  if (!logoFile) highlight(form.game_logo);
  if (!bannerFile) highlight(form.game_banner);
  if (networks.length === 0) highlight(form.networks);
  if (platforms.length === 0) highlight(form.game_platforms);
  if (!minVolume || isNaN(minVolume) || minVolume < 1000) highlight(form.min_liquidity_volume);
  if (logoFile?.size > 2_000_000) highlight(form.game_logo);
  if (bannerFile?.size > 2_000_000) highlight(form.game_banner);

  const checkImageDimensions = (file, expectedWidth, expectedHeight) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width === expectedWidth && img.height === expectedHeight);
      img.onerror = () => resolve(false);
      img.src = URL.createObjectURL(file);
    });
  };

  const isLogoValid = await checkImageDimensions(logoFile, 400, 400);
  if (!isLogoValid) {
    highlight(form.game_logo);
    return alert("⚠️ Logo must be exactly 400x400 pixels.");
  }

  const isBannerValid = await checkImageDimensions(bannerFile, 1500, 500);
  if (!isBannerValid) {
    highlight(form.game_banner);
    return alert("⚠️ Banner must be exactly 1500x500 pixels.");
  }

  if (!valid) return alert("⚠️ Please correct the highlighted fields.");

  formData.append("game_name", gameName);
  formData.append("game_engine", engine);
  formData.append("description", desc);
  formData.append("accepted_tokens", tokens);
  formData.append("min_liquidity_volume", minVolume);
  formData.append("auto_accept_liquid_tokens", form.auto_accept_liquid_tokens.checked);
  networks.forEach(n => formData.append("networks", n));
  platforms.forEach(p => formData.append("game_platforms", p));
  formData.append("game_logo", logoFile);
  formData.append("game_banner", bannerFile);

  const apiURL = "https://hyp3rmatrix.xyz";

  try {
    const response = await fetch(`${apiURL}/api/game/register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`
      },
      body: formData
    });

    const result = await response.json();
    if (result.status === "success") {
      const doneMsg = document.createElement("div");
      doneMsg.textContent = "🎉 Registration Complete!";
      doneMsg.style.background = "#222";
      doneMsg.style.color = "#ffd700";
      doneMsg.style.padding = "12px 20px";
      doneMsg.style.fontWeight = "bold";
      doneMsg.style.border = "2px solid #ffd700";
      doneMsg.style.borderRadius = "8px";
      doneMsg.style.marginBottom = "30px";
      doneMsg.style.textAlign = "center";
      document.querySelector(".content").prepend(doneMsg);
      form.querySelectorAll("input, textarea, select, button").forEach(el => el.disabled = true);
      localStorage.setItem("gameKey", result.game_key);
      alert("✅ Game Registered! Game Key: " + result.game_key);
      showContinueButton(result.game_key);
    } else {
      alert("❌ Error: " + result.message);
    }
  } catch (error) {
    console.error("❌ Registration failed:", error);
    alert("❌ Network error during registration.");
  }
}

function showContinueButton(gameKey) {
  const container = document.querySelector(".content");

  const note = document.createElement("p");
  note.textContent = "⚠️ This is your only opportunity to save your Game Key. Do not lose it. It will not be shown again.";
  note.style.color = "#ffd700";
  note.style.fontWeight = "bold";
  note.style.marginTop = "30px";
  container.appendChild(note);

  const keyBox = document.createElement("p");
  keyBox.innerHTML = `<strong>Game Key:</strong> <code id="gameKeyDisplay" style="color: #ffd700; font-weight: bold; background: #111; padding: 4px 8px; border-radius: 5px;">${gameKey}</code>`;
  keyBox.style.marginTop = "10px";
  container.appendChild(keyBox);
  keyBox.style.opacity = "0";
  keyBox.style.transition = "opacity 0.6s ease";
  requestAnimationFrame(() => {
    keyBox.style.opacity = "1";
  });
  keyBox.scrollIntoView({ behavior: "smooth", block: "center" });

  const copyBtn = document.createElement("button");
  copyBtn.innerHTML = "📋 Copy Game Key";
  copyBtn.className = "cta-button";
  copyBtn.title = "Click to copy the Game Key to clipboard";
  copyBtn.onclick = () => {
    const text = document.getElementById("gameKeyDisplay").textContent;
    navigator.clipboard.writeText(text).then(() => {
      alert("📋 Game Key copied to clipboard.");
      const flash = document.getElementById("gameKeyDisplay");
      flash.style.transition = "background-color 0.3s ease";
      flash.style.backgroundColor = "#ffee32";
      setTimeout(() => flash.style.backgroundColor = "#111", 1000);
      copyBtn.textContent = "Copied! (Click to Copy Again)";
      copyBtn.disabled = false;
      copyBtn.style.opacity = "1.0";
    });
  };
  copyBtn.style.opacity = "0";
  copyBtn.style.transition = "opacity 0.6s ease";
  container.appendChild(copyBtn);
  requestAnimationFrame(() => {
    copyBtn.style.opacity = "1";
  });
  requestAnimationFrame(() => {
    copyBtn.style.opacity = "1";
  });
  container.appendChild(copyBtn);

  const btn = document.createElement("button");
  btn.textContent = "Continue to Game Portal";
  btn.className = "cta-button";
  btn.onclick = () => {
    window.location.href = `Game_Portal.html?gameKey=${encodeURIComponent(gameKey)}`;
  };
  btn.style.opacity = "0";
  btn.style.transition = "opacity 0.6s ease";
  container.appendChild(btn);
  requestAnimationFrame(() => {
    btn.style.opacity = "1";
  });
  btn.scrollIntoView({ behavior: "smooth", block: "center" });
  requestAnimationFrame(() => {
    btn.style.opacity = "1";
  });
  btn.scrollIntoView({ behavior: "smooth", block: "center" });
  btn.scrollIntoView({ behavior: "smooth", block: "center" });
}
