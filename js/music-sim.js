/* 按需加载并渲染 public/15 下的光遇琴谱。 */
(function () {
	"use strict";

	function cleanMusicData(raw) {
		return String(raw || "")
			.replace(/[\u0000-\u001f\u007f-\u009f\ufeff]+/g, "")
			.replace(/,+/g, ",")
			.replace(/^,|,$/g, "")
			.trim();
	}

	function parseBeats(raw) {
		const tokens = cleanMusicData(raw).split(",").map((token) => token.trim()).filter(Boolean);
		const beats = [];
		let pending = null;

		for (let index = 0; index < tokens.length;) {
			const token = tokens[index].toLowerCase();
			if (!/^[a-o]$/.test(token)) {
				index += 1;
				continue;
			}

			const next = tokens[index + 1];
			const hasDuration = next !== undefined && next !== "" && Number.isFinite(Number(next));
			const duration = hasDuration ? Math.max(0, Number(next)) : 0;
			index += hasDuration ? 2 : 1;

			if (!pending) pending = { notes: [], durations: [], durationMs: 0 };
			pending.notes.push(token);
			pending.durations.push(duration);

			if (duration > 0) {
				pending.durationMs = Math.max(40, duration * 1000);
				beats.push(pending);
				pending = null;
			}
		}

		if (pending && pending.notes.length) {
			pending.durationMs = 120;
			beats.push(pending);
		}
		return beats;
	}

	const noteFiles = [
		"01_C4.wav", "02_D4.wav", "03_E4.wav", "04_F4.wav", "05_G4.wav",
		"06_A4.wav", "07_B4.wav", "08_C5.wav", "09_D5.wav", "10_E5.wav",
		"11_F5.wav", "12_G5.wav", "13_A5.wav", "14_B5.wav", "15_C6.wav",
	];
	const audioBankPromises = new Map();
	let audioContext = null;

	function getAudioContext() {
		if (!audioContext) {
			const AudioContext = window.AudioContext || window.webkitAudioContext;
			if (AudioContext) audioContext = new AudioContext();
		}
		return audioContext;
	}

	async function preloadAudioBank(baseUrl, instrument, status) {
		const context = getAudioContext();
		if (!context) {
			status.textContent = "当前浏览器不支持音频播放";
			return new Map();
		}
		const bankKey = `${baseUrl}|${instrument}`;
		if (!audioBankPromises.has(bankKey)) {
			status.textContent = "正在缓存 15 个按键音色…";
			audioBankPromises.set(bankKey, Promise.all(noteFiles.map(async (fileName, index) => {
				try {
					const response = await fetch(`${baseUrl}${instrument}-15/${fileName}`, { cache: "force-cache" });
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const audioBuffer = await context.decodeAudioData(await response.arrayBuffer());
					return [String.fromCharCode(97 + index), audioBuffer];
				} catch (error) {
					console.warn(`音色 ${fileName} 缓存失败`, error);
					return null;
				}
			})).then((entries) => new Map(entries.filter(Boolean))));
		}
		const bank = await audioBankPromises.get(bankKey);
		status.textContent = bank.size === noteFiles.length
			? `${instrument === "piano" ? "钢琴" : "吉他"}音色已缓存`
			: `已缓存 ${bank.size}/${noteFiles.length} 个音色`;
		return bank;
	}

	function playNotes(notes, bank, activeSources) {
		const context = getAudioContext();
		if (!context || !bank?.size) return;
		notes.forEach((note) => {
			const buffer = bank.get(note);
			if (!buffer) return;
			const source = context.createBufferSource();
			const gain = context.createGain();
			gain.gain.value = 0.7;
			source.buffer = buffer;
			source.connect(gain);
			gain.connect(context.destination);
			activeSources?.add(source);
			source.onended = () => activeSources?.delete(source);
			source.start();
		});
	}

	function addStyles(container) {
		if (container.querySelector("style[data-music-sim-style]")) return;
		const style = document.createElement("style");
		style.dataset.musicSimStyle = "true";
		style.textContent = `
			.music-sim-root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
			.music-sim-state{min-height:12rem;display:flex;align-items:center;justify-content:center;gap:.75rem;color:var(--text-secondary,#6b7280)}
			.music-sim-spinner{width:1.5rem;height:1.5rem;border:3px solid rgba(127,127,127,.2);border-top-color:var(--primary,#7c3aed);border-radius:999px;animation:music-sim-spin .8s linear infinite}
			@keyframes music-sim-spin{to{transform:rotate(360deg)}}
			.ms-header{display:inline-flex;align-items:center;flex:0 0 auto;margin:0;padding:0;border:0;background:none}
			.music-sim-root>.ms-header{margin-bottom:.75rem}
			.ms-instrument{min-height:2.25rem;max-width:6rem;padding:.4rem .65rem;border:1px solid var(--line-divider,rgba(127,127,127,.12));border-radius:.6rem;background:var(--btn-regular-bg,rgba(127,127,127,.12));color:var(--btn-content,inherit);font:700 .75rem system-ui,-apple-system,sans-serif;cursor:pointer}
			.ms-instrument:hover:not(:disabled){background:var(--btn-regular-bg-hover,rgba(127,127,127,.18))}
			.ms-instrument:focus-visible{outline:2px solid var(--primary,#7c3aed);outline-offset:3px}
			.ms-instrument:disabled{opacity:.5;cursor:wait}
			.ms-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
			.ms-beats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45rem}
			.ms-card{min-width:0;padding:.32rem;border:1px solid rgba(127,127,127,.12);border-radius:.65rem;background:var(--card-bg,transparent);transition:.2s}
			.ms-card.active{transform:translateY(-3px);border-color:var(--primary,#7c3aed);box-shadow:0 10px 24px rgba(0,0,0,.12);outline:3px solid color-mix(in oklch,var(--primary,#7c3aed) 20%,transparent)}
			.ms-card-header{display:flex;justify-content:space-between;gap:.15rem;margin-bottom:.25rem;font-size:.6rem;color:var(--text-secondary,#6b7280)}
			.ms-seq{font-weight:800;color:var(--primary,#7c3aed)}
			.ms-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.12rem}
			.ms-key{aspect-ratio:1;min-width:0;display:grid;place-items:center;border:1px solid rgba(127,127,127,.12);border-radius:.28rem;background:var(--btn-regular-bg,rgba(127,127,127,.08));font-size:clamp(.42rem,.75vw,.62rem);font-weight:800}
			.ms-key.active-key{background:var(--primary,#7c3aed);border-color:transparent;color:white;transform:scale(1.04)}
			@media(max-width:480px){.ms-beats{gap:.3rem}.ms-card{padding:.24rem;border-radius:.55rem}.ms-card-header{font-size:.52rem}.ms-grid{gap:.08rem}.ms-key{border-radius:.22rem;font-size:.42rem}}
		`;
		container.appendChild(style);
	}

	async function render(container, raw) {
		if (!container.isConnected) return;
		window.__musicSimCleanup?.();
		container.__musicSimCleanup?.();
		const beats = parseBeats(raw);
		container.replaceChildren();
		addStyles(container);

		if (!beats.length) {
			const empty = document.createElement("div");
			empty.className = "music-sim-state";
			empty.textContent = "这个文件中没有可识别的琴谱数据。";
			container.appendChild(empty);
			return;
		}

		const root = document.createElement("div");
		root.className = "music-sim-root";
		const header = document.createElement("div");
		header.className = "ms-header";
		header.innerHTML = '<select class="ms-instrument" data-action="instrument" aria-label="切换音色" title="切换音色" disabled><option value="piano">钢琴</option><option value="guitar">吉他</option></select><span class="ms-audio-state ms-sr-only" role="status" aria-live="polite">正在准备音色…</span>';
		const beatsContainer = document.createElement("div");
		beatsContainer.className = "ms-beats";
		const soundSlot = container.closest("score-views")?.querySelector("[data-sound-slot]");
		if (soundSlot) {
			soundSlot.querySelector(".ms-header")?.remove();
			soundSlot.appendChild(header);
		} else root.appendChild(header);
		root.appendChild(beatsContainer);
		container.appendChild(root);

		const keyLayout = "abcdefghijklmno".split("");
		beats.forEach((beat, beatIndex) => {
			const card = document.createElement("div");
			card.className = "ms-card";
			card.dataset.index = String(beatIndex);
			const cardHeader = document.createElement("div");
			cardHeader.className = "ms-card-header";
			cardHeader.innerHTML = `<span class="ms-seq">${beatIndex + 1}/${beats.length}</span><span>${(beat.durationMs / 1000).toFixed(2)}s</span>`;
			const grid = document.createElement("div");
			grid.className = "ms-grid";
			keyLayout.forEach((letter) => {
				const key = document.createElement("div");
				key.className = "ms-key";
				key.textContent = letter.toUpperCase();
				if (beat.notes.includes(letter)) key.classList.add("active-key");
				grid.appendChild(key);
			});
			card.append(cardHeader, grid);
			beatsContainer.appendChild(card);
		});

		const instrumentSelect = header.querySelector('[data-action="instrument"]');
		const audioStatus = header.querySelector(".ms-audio-state");
		const floatingControls = document.getElementById("floating-music-controls");
		const floatingPlayButton = document.getElementById("floating-play-btn");
		const floatingPauseButton = document.getElementById("floating-pause-btn");
		const floatingStopButton = document.getElementById("floating-stop-btn");
		const floatingStatus = document.getElementById("floating-music-status");
		if (!floatingControls || !floatingPlayButton || !floatingPauseButton || !floatingStopButton || !floatingStatus) {
			throw new Error("悬浮播放组件未加载");
		}
		floatingControls.hidden = false;
		window.__musicSimFloatingAbort?.abort();
		const floatingAbort = new AbortController();
		window.__musicSimFloatingAbort = floatingAbort;
		let current = 0;
		let playing = false;
		let starting = false;
		let playbackVersion = 0;
		let timeoutId = 0;
		let audioReady = false;
		let audioLoading = false;
		let disposed = false;
		let loadVersion = 0;
		let instrument = "piano";
		let audioBank = new Map();
		const activeSources = new Set();
		const audioBaseUrl = container.dataset.audioBase || "/audio/";
		const observer = new MutationObserver(() => { if (!container.isConnected) dispose(); });
		window.__musicSimCleanup = dispose;
		container.__musicSimCleanup = dispose;
		observer.observe(document.body, { childList: true, subtree: true });

		function clearActive() {
			const activeCard = beatsContainer.querySelector(".ms-card.active");
			activeCard?.classList.remove("active");
			activeCard?.removeAttribute("aria-current");
		}
		function ownsControls() {
			return !disposed && container.isConnected && window.__musicSimCleanup === dispose;
		}
		function updateControls() {
			if (!ownsControls()) return;
			floatingPlayButton.disabled = playing || starting || !audioReady || audioLoading;
			floatingPauseButton.disabled = !playing;
			floatingStopButton.disabled = !playing && current === 0;
			instrumentSelect.disabled = audioLoading;
			instrumentSelect.setAttribute("aria-busy", String(audioLoading));
		}
		function updatePosition(position) {
			if (ownsControls()) floatingStatus.textContent = position ? `${position} / ${beats.length}` : "";
		}
		function stopSources() {
			activeSources.forEach((source) => { try { source.stop(); } catch {} });
			activeSources.clear();
		}
		function stop() {
			playbackVersion += 1;
			window.clearTimeout(timeoutId);
			stopSources();
			playing = false;
			current = 0;
			clearActive();
			updatePosition(0);
			updateControls();
		}
		function dispose() {
			if (disposed) return;
			stop();
			disposed = true;
			loadVersion += 1;
			floatingAbort.abort();
			observer.disconnect();
			header.remove();
			if (container.__musicSimCleanup === dispose) delete container.__musicSimCleanup;
			if (window.__musicSimCleanup === dispose) {
				delete window.__musicSimCleanup;
				floatingControls.hidden = true;
				floatingPlayButton.disabled = floatingPauseButton.disabled = floatingStopButton.disabled = true;
				floatingStatus.textContent = "";
			}
		}
		function step() {
			if (!ownsControls()) { dispose(); return; }
			if (!playing || current >= beats.length) {
				stop();
				return;
			}
			clearActive();
			const card = beatsContainer.querySelector(`[data-index="${current}"]`);
			card?.classList.add("active");
			card?.setAttribute("aria-current", "step");
			card?.scrollIntoView({ behavior: "smooth", block: "center" });
			updatePosition(current + 1);
			playNotes(beats[current].notes, audioBank, activeSources);
			const duration = beats[current].durationMs;
			current += 1;
			timeoutId = window.setTimeout(step, duration);
			updateControls();
		}
		async function start() {
			if (playing || starting || !ownsControls() || !audioReady || audioLoading) return;
			starting = true;
			updateControls();
			const version = playbackVersion;
			try {
				await getAudioContext()?.resume();
				if (!ownsControls() || version !== playbackVersion || !audioReady || audioLoading) return;
				playing = true;
				step();
			} catch (error) {
				if (ownsControls()) audioStatus.textContent = "声音未能启动，请再次点击播放。";
				console.warn("音频启动失败", error);
			} finally { starting = false; updateControls(); }
		}
		function pause() {
			playbackVersion += 1;
			playing = false;
			window.clearTimeout(timeoutId);
			stopSources();
			updateControls();
		}
		floatingPlayButton.addEventListener("click", start, { signal: floatingAbort.signal });
		floatingPauseButton.addEventListener("click", pause, { signal: floatingAbort.signal });
		floatingStopButton.addEventListener("click", stop, { signal: floatingAbort.signal });
		async function loadInstrument() {
			const version = ++loadVersion;
			const requestedInstrument = instrumentSelect.value;
			const resumeAfterLoad = playing;
			if (playing) pause();
			const resumeVersion = playbackVersion;
			audioLoading = true;
			instrumentSelect.title = `正在加载${requestedInstrument === "piano" ? "钢琴" : "吉他"}音色`;
			updateControls();
			try {
				const bank = await preloadAudioBank(audioBaseUrl, requestedInstrument, audioStatus);
				if (!ownsControls() || version !== loadVersion) return;
				if (bank.size) {
					audioBank = bank;
					instrument = requestedInstrument;
					audioReady = true;
				} else {
					audioBankPromises.delete(`${audioBaseUrl}|${requestedInstrument}`);
					instrumentSelect.value = instrument;
					audioReady = audioBank.size > 0;
					audioStatus.textContent = audioReady ? "音色加载失败，继续使用原音色。" : "音色暂时无法加载，请稍后重新选择。";
				}
			} catch (error) {
				if (!ownsControls() || version !== loadVersion) return;
				instrumentSelect.value = instrument;
				audioReady = audioBank.size > 0;
				audioStatus.textContent = "音色加载失败，请稍后重试。";
				console.warn("音色切换失败", error);
			} finally {
				if (ownsControls() && version === loadVersion) {
					audioLoading = false;
					instrumentSelect.title = `切换音色：${instrumentSelect.value === "piano" ? "钢琴" : "吉他"}`;
					updateControls();
					if (resumeAfterLoad && audioReady && resumeVersion === playbackVersion) void start();
				}
			}
		}
		instrumentSelect.addEventListener("change", loadInstrument, { signal: floatingAbort.signal });
		updatePosition(0);
		await loadInstrument();
	}

	async function initializeElement(container) {
		if (!container || container.dataset.musicSimState) return;
		container.dataset.musicSimState = "loading";
		container.replaceChildren();
		addStyles(container);
		const loading = document.createElement("div");
		loading.className = "music-sim-state";
		loading.innerHTML = '<span class="music-sim-spinner" aria-hidden="true"></span>正在加载琴谱文件…';
		container.appendChild(loading);
		try {
			let raw = container.dataset.music || "";
			if (container.dataset.src) {
				const response = await fetch(container.dataset.src, { cache: "force-cache" });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				raw = await response.text();
			}
			if (!container.isConnected) return;
			await render(container, raw);
			if (container.isConnected) container.dataset.musicSimState = "ready";
		} catch (error) {
			console.error("琴谱加载失败", error);
			container.innerHTML = '<div class="music-sim-state">琴谱文件加载失败，请稍后重试。</div>';
			container.dataset.musicSimState = "error";
		}
	}

	function init(root) {
		const elements = root?.matches?.(".music-sim") ? [root] : Array.from((root || document).querySelectorAll(".music-sim"));
		const pending = elements.filter((element) => !element.dataset.musicSimState);
		if (!("IntersectionObserver" in window)) {
			pending.forEach(initializeElement);
			return;
		}
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				observer.unobserve(entry.target);
				initializeElement(entry.target);
			});
		}, { rootMargin: "240px 0px" });
		pending.forEach((element) => observer.observe(element));
	}

	window.MusicSim = { cleanMusicData, init, parseBeats, render };
	window.__musicSim_init = init;
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init(document), { once: true });
	else init(document);
})();
