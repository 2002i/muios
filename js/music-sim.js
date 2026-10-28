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

	function playNotes(notes, bank, activeSources, offsetMs = 0) {
		const context = getAudioContext();
		if (!context || !bank?.size) return;
		notes.forEach((note) => {
			const buffer = bank.get(note);
			if (!buffer) return;
			const offset = Math.max(0, offsetMs / 1000);
			if (offset >= buffer.duration) return;
			const source = context.createBufferSource();
			const gain = context.createGain();
			gain.gain.value = 0.7;
			source.buffer = buffer;
			source.connect(gain);
			gain.connect(context.destination);
			activeSources?.add(source);
			source.onended = () => activeSources?.delete(source);
			source.start(0, offset);
		});
	}


	// The audio session belongs to the document, not a particular score view.
	// Swup can replace every detail node while this transport keeps playing.
	function createPlayer() {
		let source = { src: "", title: "", audioBase: "/audio/" };
		let beats = [];
		let beatStarts = [0];
		let durationMs = 0;
		let current = 0;
		let playbackState = "stopped";
		let elapsedMs = 0;
		let anchorMs = 0;
		let timeoutId = 0;
		let lastPlayedIndex = -1;
		let instrument = "piano";
		let bankInstrument = "";
		let bankBase = "";
		let audioBank = new Map();
		let loading = false;
		let audioLoading = false;
		let error = "";
		let requestVersion = 0;
		let controlVersion = 0;
		let instrumentVersion = 0;
		let request;
		let pendingLoad;
		const listeners = new Set();
		const activeSources = new Set();
		const clockMs = () => (getAudioContext()?.currentTime ?? performance.now() / 1000) * 1000;
		const positionMs = () => Math.min(durationMs, Math.max(0, elapsedMs + (playbackState === "playing" ? clockMs() - anchorMs : 0)));
		function snapshot() {
			return Object.freeze({ state: playbackState, index: current, elapsedMs: positionMs(), durationMs,
				src: source.src, title: source.title, instrument, loading: loading || audioLoading, error, beatsCount: beats.length });
		}
		function publish() {
			const value = snapshot();
			for (const listener of [...listeners]) {
				try { listener(value); } catch (cause) { console.error("播放器状态监听失败", cause); }
			}
			document.dispatchEvent(new CustomEvent("score:player-state", { detail: value }));
		}
		function stopSources() {
			activeSources.forEach((node) => { try { node.stop(); } catch {} });
			activeSources.clear();
		}
		function stopTimer() { window.clearTimeout(timeoutId); stopSources(); }
		function pause() {
			controlVersion += 1;
			if (playbackState !== "playing") return;
			elapsedMs = positionMs();
			playbackState = "paused";
			lastPlayedIndex = -1;
			stopTimer(); publish();
		}
		function stop() {
			controlVersion += 1;
			stopTimer(); playbackState = "stopped"; elapsedMs = 0; current = 0; lastPlayedIndex = -1;
			publish();
		}
		function step() {
			if (playbackState !== "playing") return;
			const position = positionMs();
			if (position >= durationMs) {
				playbackState = "ended"; elapsedMs = durationMs; current = Math.max(0, beats.length - 1);
				stopTimer(); publish(); return;
			}
			while (current < beats.length - 1 && position >= beatStarts[current + 1]) current += 1;
			if (lastPlayedIndex !== current) {
				playNotes(beats[current].notes, audioBank, activeSources, position - beatStarts[current]);
				lastPlayedIndex = current;
			}
			// Schedule before publishing: an ended/queue callback may replace this
			// session synchronously, so there must be no work after notification.
			timeoutId = window.setTimeout(step, Math.max(1, beatStarts[current + 1] - position));
			publish();
		}
		async function ensureBank() {
			for (;;) {
				const selected = instrument;
				const base = source.audioBase;
				if (audioBank.size && bankInstrument === selected && bankBase === base) return;
				const bank = await preloadAudioBank(base, selected, { textContent: "" });
				if (selected !== instrument || base !== source.audioBase) continue;
				if (!bank.size) {
					audioBankPromises.delete(`${base}|${selected}`);
					throw new Error("音色暂时无法加载，请重试。");
				}
				audioBank = bank; bankInstrument = selected; bankBase = base; return;
			}
		}
		async function play() {
			if (playbackState === "playing" || loading || audioLoading || !beats.length) return;
			const version = ++controlVersion;
			try {
				const context = getAudioContext();
				if (!context) throw new Error("当前浏览器不支持音频播放。");
				await context.resume();
				if (version !== controlVersion || loading || audioLoading || !beats.length) return;
				if (!audioBank.size) await ensureBank();
				if (version !== controlVersion) return;
				if (playbackState === "ended") { elapsedMs = 0; current = 0; lastPlayedIndex = -1; }
				error = ""; anchorMs = clockMs(); playbackState = "playing"; step();
			} catch (cause) {
				if (version !== controlVersion) return;
				error = cause instanceof Error ? cause.message : "声音未能启动，请再次点击播放。";
				publish(); throw cause;
			}
		}
		async function load(item, options = {}) {
			const src = String(item?.src || "");
			if (!src) throw new Error("琴谱链接为空。");
			// Unlock iOS audio from the original click, before awaiting network I/O.
			if (options.autoplay) void getAudioContext()?.resume().catch(() => {});
			if (source.src === src && pendingLoad && loading) {
				const version = requestVersion;
				const intent = options.autoplay ? ++controlVersion : controlVersion;
				await pendingLoad;
				if (version === requestVersion && intent === controlVersion && options.autoplay) await play();
				return;
			}
			if (source.src === src && beats.length && !loading && !error) {
				if (options.autoplay) await play();
				return;
			}
			const version = ++requestVersion;
			const intent = ++controlVersion;
			request?.abort(); request = new AbortController();
			const signal = request.signal;
			stopTimer(); playbackState = "stopped"; elapsedMs = 0; current = 0; lastPlayedIndex = -1;
			beats = []; beatStarts = [0]; durationMs = 0;
			source = { src, title: String(item.title || "未命名琴谱"), audioBase: String(item.audioBase || "/audio/") };
			if (!source.audioBase.endsWith("/")) source.audioBase += "/";
			loading = true; error = ""; publish();
			pendingLoad = (async () => {
				const timeout = window.setTimeout(() => request?.signal === signal && request.abort(), 15000);
				try {
					const response = await fetch(src, { signal, cache: "force-cache" });
					if (!response.ok) throw new Error(`琴谱读取失败（HTTP ${response.status}）`);
					const parsed = parseBeats(await response.text());
					if (!parsed.length) throw new Error("这份琴谱没有可播放的音符。");
					if (version !== requestVersion) return;
					beats = parsed;
					beatStarts = [0]; beats.forEach((beat) => beatStarts.push(beatStarts.at(-1) + beat.durationMs));
					durationMs = beatStarts.at(-1);
					await ensureBank();
					if (version !== requestVersion) return;
					loading = false; publish();
					if (options.autoplay && intent === controlVersion) await play();
				} catch (cause) {
					if (version !== requestVersion) return;
					loading = false; error = cause?.name === "AbortError" ? "琴谱读取超时，请重试。" : cause instanceof Error ? cause.message : "琴谱加载失败，请重试。";
					publish(); throw cause;
				} finally { window.clearTimeout(timeout); if (version === requestVersion) pendingLoad = undefined; }
			})();
			await pendingLoad;
		}
		async function setInstrument(value) {
			if (value !== "piano" && value !== "guitar") return;
			if (instrument === value && bankInstrument === value && audioBank.size) return;
			const version = ++instrumentVersion;
			const previous = instrument;
			const resumeAfterLoad = playbackState === "playing";
			if (resumeAfterLoad) pause();
			const intent = controlVersion;
			instrument = value; audioLoading = true; error = ""; publish();
			try {
				await ensureBank();
				if (version !== instrumentVersion) return;
				audioLoading = false; publish();
				if (resumeAfterLoad && intent === controlVersion) await play();
			} catch (cause) {
				if (version !== instrumentVersion) return;
				instrument = previous; audioLoading = false;
				error = cause instanceof Error ? cause.message : "音色加载失败，请重试。";
				publish(); throw cause;
			}
		}
		return Object.freeze({ load, play, pause, stop, setInstrument, getSnapshot: snapshot,
			subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); } });
	}
	const player = createPlayer();

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
		const playbackHost = container.closest("score-views") || container;
		const events = new AbortController();
		let disposed = false;
		let activeIndex = -1;
		const localSrc = container.dataset.src || "";
		const observer = new MutationObserver(() => { if (!container.isConnected) dispose(); });
		function matchingSnapshot() {
			const value = player.getSnapshot();
			if (localSrc && value.src === localSrc) return value;
			return Object.freeze({ state: "stopped", index: 0, elapsedMs: 0,
				durationMs: beats.reduce((total, beat) => total + beat.durationMs, 0), src: localSrc,
				title: container.dataset.title || "", instrument: value.instrument, loading: false, error: "", beatsCount: beats.length });
		}
		function clearActive() {
			const card = beatsContainer.querySelector(".ms-card.active");
			card?.classList.remove("active"); card?.removeAttribute("aria-current");
		}
		function publishPlayback() {
			if (disposed) return;
			container.dispatchEvent(new CustomEvent("score:playback", { bubbles: true, detail: matchingSnapshot() }));
		}
		function update(snapshot) {
			if (disposed) return;
			instrumentSelect.disabled = snapshot.loading;
			instrumentSelect.value = snapshot.instrument;
			instrumentSelect.title = `切换音色：${snapshot.instrument === "piano" ? "钢琴" : "吉他"}`;
			instrumentSelect.setAttribute("aria-busy", String(snapshot.loading));
			audioStatus.textContent = snapshot.error || (snapshot.loading ? "正在准备播放器…" : "");
			const active = localSrc && snapshot.src === localSrc && ["playing", "paused"].includes(snapshot.state);
			if (!active) { clearActive(); activeIndex = -1; }
			else if (activeIndex !== snapshot.index) {
				clearActive(); activeIndex = snapshot.index;
				const card = beatsContainer.querySelector(`[data-index="${activeIndex}"]`);
				card?.classList.add("active"); card?.setAttribute("aria-current", "step");
				if (snapshot.state === "playing" && playbackHost.dataset.currentView !== "number" && card?.getClientRects().length) card.scrollIntoView({ behavior: "smooth", block: "center" });
			}
			publishPlayback();
		}
		function dispose() {
			if (disposed) return;
			disposed = true; unsubscribe(); events.abort(); observer.disconnect(); header.remove();
			delete container.__musicSimPlayback;
			if (container.__musicSimCleanup === dispose) delete container.__musicSimCleanup;
		}
		Object.defineProperty(container, "__musicSimPlayback", { configurable: true, get: matchingSnapshot });
		const unsubscribe = player.subscribe(update);
		container.__musicSimCleanup = dispose;
		observer.observe(document.body, { childList: true, subtree: true });
		playbackHost.addEventListener("score:playback-request", publishPlayback, { signal: events.signal });
		instrumentSelect.addEventListener("change", () => {
			void player.setInstrument(instrumentSelect.value).catch(() => {});
		}, { signal: events.signal });
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

	window.MusicSim = { cleanMusicData, init, parseBeats, render, player };
	window.__musicSim_init = init;
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init(document), { once: true });
	else init(document);
})();
