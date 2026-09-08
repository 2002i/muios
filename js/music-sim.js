/* 按需加载并渲染 public/score 下的光遇琴谱。 */
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

	function playNotes(notes, bank) {
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
			.ms-header{position:relative;z-index:20;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:1rem;padding:.75rem;border:1px solid rgba(127,127,127,.12);border-radius:.9rem;background:color-mix(in oklch,var(--card-bg,#fff) 90%,transparent);backdrop-filter:blur(14px)}
			.ms-title{display:flex;flex-direction:column;gap:.15rem}
			.ms-heading{font-weight:800;color:var(--primary,#7c3aed)}
			.ms-audio-state{font-size:.75rem;color:var(--text-secondary,#6b7280)}
			.ms-controls{display:flex;align-items:center;gap:.5rem}
			.ms-controls button,.ms-controls select{height:2.25rem;padding:0 .75rem;border:0;border-radius:.65rem;background:var(--enter-btn-bg,rgba(127,127,127,.12));color:var(--btn-content,inherit);font-weight:700;cursor:pointer;transition:.2s}
			.ms-controls button:hover:not(:disabled){transform:translateY(-1px);background:var(--enter-btn-bg-hover,rgba(127,127,127,.18))}
			.ms-controls button:disabled{opacity:.45;cursor:not-allowed}
			.ms-status{min-width:4rem;text-align:right;font-size:.8rem;color:var(--text-secondary,#6b7280)}
			.ms-beats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45rem}
			.ms-card{min-width:0;padding:.32rem;border:1px solid rgba(127,127,127,.12);border-radius:.65rem;background:var(--card-bg,transparent);transition:.2s}
			.ms-card.active{transform:translateY(-3px);border-color:var(--primary,#7c3aed);box-shadow:0 10px 24px rgba(0,0,0,.12);outline:3px solid color-mix(in oklch,var(--primary,#7c3aed) 20%,transparent)}
			.ms-card-header{display:flex;justify-content:space-between;gap:.15rem;margin-bottom:.25rem;font-size:.6rem;color:var(--text-secondary,#6b7280)}
			.ms-seq{font-weight:800;color:var(--primary,#7c3aed)}
			.ms-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.12rem}
			.ms-key{aspect-ratio:1;min-width:0;display:grid;place-items:center;border:1px solid rgba(127,127,127,.12);border-radius:.28rem;background:var(--btn-regular-bg,rgba(127,127,127,.08));font-size:clamp(.42rem,.75vw,.62rem);font-weight:800}
			.ms-key.active-key{background:var(--primary,#7c3aed);border-color:transparent;color:white;transform:scale(1.04)}
			.ms-floating-player{position:fixed;right:5.5rem;bottom:1.5rem;z-index:9999;display:flex;align-items:center;gap:.55rem;min-width:17rem;max-width:calc(100vw - 7rem);padding:.65rem .8rem;border:1px solid rgba(127,127,127,.16);border-radius:1rem;background:color-mix(in oklch,var(--card-bg,#fff) 88%,transparent);box-shadow:0 14px 40px rgba(0,0,0,.18);backdrop-filter:blur(18px);opacity:0;pointer-events:none;transform:translateY(calc(100% + 1rem));transition:opacity .2s ease,transform .25s ease}
			.ms-floating-player.is-visible{opacity:1;pointer-events:auto;transform:translateY(0)}
			.ms-floating-player strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--primary,#7c3aed)}
			.ms-floating-player button{height:2.35rem;padding:0 .75rem;border:0;border-radius:.7rem;background:var(--enter-btn-bg,rgba(127,127,127,.12));color:var(--btn-content,inherit);font-weight:800;cursor:pointer}
			.ms-floating-player button:disabled{opacity:.45;cursor:not-allowed}
			.ms-floating-status{margin-left:auto;white-space:nowrap;font-size:.75rem;color:var(--text-secondary,#6b7280)}
			@media(max-width:480px){.ms-header{align-items:flex-start}.ms-controls{width:100%;gap:.3rem}.ms-controls button,.ms-controls select{padding:0 .55rem}.ms-status{margin-left:auto}.ms-floating-player{right:5.5rem;bottom:1.5rem;width:calc(100vw - 7rem);min-width:0;gap:.3rem;padding:.5rem .55rem}.ms-floating-player strong{display:none}.ms-floating-player button{flex:1;min-width:0;padding:0 .45rem}.ms-floating-status{margin-left:0}}
		`;
		container.appendChild(style);
	}

	async function render(container, raw) {
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
		header.innerHTML = '<div class="ms-title"><div class="ms-heading">模拟光遇按键</div><div class="ms-audio-state">准备音色缓存…</div></div><div class="ms-controls"><select data-action="instrument" aria-label="选择音色"><option value="piano">钢琴</option><option value="guitar">吉他</option></select><button type="button" data-action="play" disabled>播放</button><button type="button" data-action="pause" disabled>暂停</button><button type="button" data-action="stop" disabled>停止</button><span class="ms-status"></span></div>';
		const beatsContainer = document.createElement("div");
		beatsContainer.className = "ms-beats";
		const floatingPlayer = document.createElement("div");
		floatingPlayer.className = "ms-floating-player";
		floatingPlayer.setAttribute("role", "region");
		floatingPlayer.setAttribute("aria-label", "悬浮播放控制");
		floatingPlayer.setAttribute("aria-hidden", "true");
		floatingPlayer.inert = true;
		floatingPlayer.innerHTML = '<strong>琴谱播放</strong><button type="button" data-floating-action="play" disabled>播放</button><button type="button" data-floating-action="pause" disabled>暂停</button><button type="button" data-floating-action="stop" disabled>停止</button><span class="ms-floating-status"></span>';
		root.append(header, beatsContainer, floatingPlayer);
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

		const playButton = header.querySelector('[data-action="play"]');
		const pauseButton = header.querySelector('[data-action="pause"]');
		const stopButton = header.querySelector('[data-action="stop"]');
		const instrumentSelect = header.querySelector('[data-action="instrument"]');
		const status = header.querySelector(".ms-status");
		const audioStatus = header.querySelector(".ms-audio-state");
		const floatingPlayButton = floatingPlayer.querySelector('[data-floating-action="play"]');
		const floatingPauseButton = floatingPlayer.querySelector('[data-floating-action="pause"]');
		const floatingStopButton = floatingPlayer.querySelector('[data-floating-action="stop"]');
		const floatingStatus = floatingPlayer.querySelector(".ms-floating-status");
		let current = 0;
		let playing = false;
		let timeoutId = 0;
		let audioReady = false;
		let audioBank = new Map();
		let headerVisible = true;
		const audioBaseUrl = container.dataset.audioBase || "/audio/";

		function clearActive() {
			const activeCard = beatsContainer.querySelector(".ms-card.active");
			activeCard?.classList.remove("active");
			activeCard?.removeAttribute("aria-current");
		}
		function updateFloatingVisibility() {
			const visible = playing || !headerVisible;
			floatingPlayer.classList.toggle("is-visible", visible);
			floatingPlayer.setAttribute("aria-hidden", String(!visible));
			floatingPlayer.inert = !visible;
		}
		function updateControls() {
			playButton.disabled = playing || !audioReady;
			floatingPlayButton.disabled = playing || !audioReady;
			pauseButton.disabled = !playing;
			floatingPauseButton.disabled = !playing;
			stopButton.disabled = !playing && current === 0;
			floatingStopButton.disabled = !playing && current === 0;
			instrumentSelect.disabled = playing;
			updateFloatingVisibility();
		}
		function updatePosition(position) {
			const value = position ? `${position} / ${beats.length}` : "";
			status.textContent = value;
			floatingStatus.textContent = value;
		}
		function stop() {
			window.clearTimeout(timeoutId);
			playing = false;
			current = 0;
			clearActive();
			updatePosition(0);
			updateControls();
		}
		function step() {
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
			playNotes(beats[current].notes, audioBank);
			const duration = beats[current].durationMs;
			current += 1;
			timeoutId = window.setTimeout(step, duration);
			updateControls();
		}
		async function start() {
			if (playing) return;
			await getAudioContext()?.resume();
			playing = true;
			step();
		}
		function pause() {
			playing = false;
			window.clearTimeout(timeoutId);
			updateControls();
		}
		playButton.addEventListener("click", start);
		floatingPlayButton.addEventListener("click", start);
		pauseButton.addEventListener("click", pause);
		floatingPauseButton.addEventListener("click", pause);
		stopButton.addEventListener("click", stop);
		floatingStopButton.addEventListener("click", stop);
		if ("IntersectionObserver" in window) {
			const headerObserver = new IntersectionObserver(([entry]) => {
				headerVisible = entry?.isIntersecting ?? true;
				updateFloatingVisibility();
			}, { threshold: 0.1 });
			headerObserver.observe(header);
		} else {
			const updateHeaderVisibility = () => {
				const rect = header.getBoundingClientRect();
				headerVisible = rect.bottom > 0 && rect.top < window.innerHeight;
				updateFloatingVisibility();
			};
			window.addEventListener("scroll", updateHeaderVisibility, { passive: true });
			updateHeaderVisibility();
		}
		instrumentSelect.addEventListener("change", async () => {
			audioReady = false;
			updateControls();
			audioBank = await preloadAudioBank(audioBaseUrl, instrumentSelect.value, audioStatus);
			audioReady = true;
			updateControls();
		});

		audioBank = await preloadAudioBank(audioBaseUrl, instrumentSelect.value, audioStatus);
		audioReady = true;
		updateControls();
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
			await render(container, raw);
			container.dataset.musicSimState = "ready";
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
