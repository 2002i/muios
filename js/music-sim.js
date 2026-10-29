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
				pending.durationMs = duration * 1000;
				beats.push(pending);
				pending = null;
			}
		}

		if (pending && pending.notes.length) {
			// A terminal chord occurs at the score's end, without adding time.
			pending.durationMs = 0;
			beats.push(pending);
		}
		return beats;
	}

	function importedMusicData(item, src) {
		if (!/^import:[a-f0-9]{64}$/.test(src)) throw new Error("导入琴谱的标识无效，请重新转换。");
		const data = item?.data;
		if (typeof data !== "string" || !data || data.length > 1024 * 1024) throw new Error("导入琴谱内容为空或超过 1 MB，请重新转换。");
		const tokens = data.split(",");
		if (tokens.length % 2 || tokens.length > 50_000 * 2) throw new Error("导入琴谱格式无效或超过 50000 个音符。");
		let duration = 0;
		for (let index = 0; index < tokens.length; index += 2) {
			if (!/^[a-o]$/.test(tokens[index]) || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(tokens[index + 1]) || !Number.isFinite(Number(tokens[index + 1])) || Number(tokens[index + 1]) < 0) throw new Error("导入琴谱含有无效的按键或延时，请重新转换。");
			duration += Number(tokens[index + 1]);
			if (duration > 24 * 60 * 60) throw new Error("导入琴谱总时长超过 24 小时，请拆分后重新转换。");
		}
		return data;
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

	function playNotes(notes, bank, activeSources, offsetMs = 0, when = 0) {
		const context = getAudioContext();
		if (!context || !bank?.size) return;
		// Simultaneous repeats of one key are one chord voice, as in the preview.
		new Set(notes).forEach((note) => {
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
			source.start(when, offset);
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
		let nextScheduledIndex = 0;
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
		function stopTimer(stopAudio = true) { window.clearTimeout(timeoutId); if (stopAudio) stopSources(); }
		function pause() {
			controlVersion += 1;
			if (playbackState !== "playing") return;
			elapsedMs = positionMs();
			playbackState = "paused";
			stopTimer(); publish();
		}
		function stop() {
			controlVersion += 1;
			stopTimer(); playbackState = "stopped"; elapsedMs = 0; current = 0; nextScheduledIndex = 0;
			publish();
		}
		function scheduleNotes(position) {
			const context = getAudioContext();
			if (!context) return;
			// Schedule audio ahead on the audio clock. UI timers may be coarser
			// than a fast score's note spacing without stretching or losing notes.
			const horizon = Math.min(durationMs, position + 150);
			while (nextScheduledIndex < beats.length && beatStarts[nextScheduledIndex] <= horizon) {
				const index = nextScheduledIndex++;
				const onset = beatStarts[index];
				const when = Math.max(context.currentTime, (anchorMs + onset - elapsedMs) / 1000);
				playNotes(beats[index].notes, audioBank, activeSources, Math.max(0, position - onset), when);
			}
		}
		function step() {
			if (playbackState !== "playing") return;
			const position = positionMs();
			while (current < beats.length - 1 && position >= beatStarts[current + 1]) current += 1;
			scheduleNotes(position);
			if (position >= durationMs) {
				playbackState = "ended"; elapsedMs = durationMs; current = Math.max(0, beats.length - 1);
				// Let the last sample (including a zero-duration terminal chord)
				// decay naturally. Stop, replay and changing tracks still cancel it.
				stopTimer(false); publish(); return;
			}
			// Schedule before publishing: an ended/queue callback may replace this
			// session synchronously, so there must be no work after notification.
			timeoutId = window.setTimeout(step, Math.max(1, Math.min(25, durationMs - position)));
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
				if (playbackState === "ended") { elapsedMs = 0; current = 0; }
				stopSources();
				while (current < beats.length - 1 && elapsedMs >= beatStarts[current + 1]) current += 1;
				nextScheduledIndex = current;
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
			// Imported tracks keep durable text in the queue and never fetch their ID.
			const importedData = /^import:/i.test(src) ? importedMusicData(item, src) : null;
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
			stopTimer(); playbackState = "stopped"; elapsedMs = 0; current = 0; nextScheduledIndex = 0;
			beats = []; beatStarts = [0]; durationMs = 0;
			source = { src, title: String(item.title || "未命名琴谱"), audioBase: String(item.audioBase || "/audio/") };
			if (!source.audioBase.endsWith("/")) source.audioBase += "/";
			loading = true; error = ""; publish();
			pendingLoad = (async () => {
				const timeout = window.setTimeout(() => request?.signal === signal && request.abort(), 15000);
				try {
					let raw = importedData;
					if (raw === null) {
						const response = await fetch(src, { signal, cache: "force-cache" });
						if (!response.ok) throw new Error(`琴谱读取失败（HTTP ${response.status}）`);
						raw = await response.text();
					}
					const parsed = parseBeats(raw);
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
		function updateMetadata(item) {
			if (item?.src !== source.src || typeof item.title !== "string" || !item.title.trim()) return;
			source.title = item.title.trim().slice(0, 300);
			publish();
		}
		return Object.freeze({ load, play, pause, stop, setInstrument, updateMetadata, getSnapshot: snapshot,
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
			.ms-pagination{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.5rem;margin:0 0 .75rem;font-size:.7rem;color:var(--text-secondary,#6b7280)}
			.ms-pagination[hidden],score-views[data-current-view="number"] .ms-pagination{display:none}
			.ms-pagination button,.ms-page-input{min-height:2.25rem;padding:.4rem .6rem;border:1px solid var(--line-divider,rgba(127,127,127,.12));border-radius:.6rem;background:var(--btn-regular-bg,rgba(127,127,127,.08));color:var(--btn-content,inherit);font:inherit}
			.ms-pagination button{cursor:pointer}.ms-pagination button:disabled{opacity:.4;cursor:default}.ms-page-input{width:4rem;text-align:center}.ms-page-label{font-variant-numeric:tabular-nums}
			.ms-pagination button:focus-visible,.ms-page-input:focus-visible{outline:2px solid var(--primary,#7c3aed);outline-offset:2px}
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
		const pagination = document.createElement("nav");
		pagination.className = "ms-pagination";
		pagination.setAttribute("aria-label", "格子谱分页");
		const previous = document.createElement("button");
		previous.type = "button"; previous.textContent = "上一页"; previous.dataset.action = "page-prev";
		const pageLabel = document.createElement("span");
		pageLabel.className = "ms-page-label"; pageLabel.setAttribute("aria-live", "polite");
		const pageInput = document.createElement("input");
		pageInput.type = "number"; pageInput.className = "ms-page-input"; pageInput.min = "1"; pageInput.step = "1"; pageInput.setAttribute("aria-label", "跳转到格子谱页码");
		const next = document.createElement("button");
		next.type = "button"; next.textContent = "下一页"; next.dataset.action = "page-next";
		const follow = document.createElement("button");
		follow.type = "button"; follow.dataset.action = "page-follow";
		pagination.append(previous, pageLabel, pageInput, next, follow);
		const soundSlot = container.closest("score-views")?.querySelector("[data-sound-slot]");
		if (soundSlot) {
			soundSlot.querySelector(".ms-header")?.remove();
			soundSlot.appendChild(header);
		} else root.appendChild(header);
		root.append(pagination, beatsContainer);
		container.appendChild(root);

		const keyLayout = "abcdefghijklmno".split("");
		const instrumentSelect = header.querySelector('[data-action="instrument"]');
		const audioStatus = header.querySelector(".ms-audio-state");
		const playbackHost = container.closest("score-views") || container;
		const events = new AbortController();
		const pageSize = 100;
		const pageCount = Math.ceil(beats.length / pageSize);
		const localDuration = beats.reduce((total, beat) => total + beat.durationMs, 0);
		const cards = new Map();
		let page = -1;
		let following = true;
		let disposed = false;
		let activeIndex = -1;
		let lastFollowAt = -Infinity;
		let unsubscribe = () => {};
		const localSrc = container.dataset.src || "";
		const observer = new MutationObserver(() => { if (!container.isConnected) dispose(); });
		const viewObserver = new MutationObserver(() => { if (playbackHost.dataset.currentView !== "number") update(player.getSnapshot(), true); });
		pagination.hidden = pageCount <= 1;
		pageInput.max = String(pageCount);
		function renderPage(value) {
			if (disposed) return;
			page = Math.max(0, Math.min(pageCount - 1, value));
			const first = page * pageSize;
			const end = Math.min(beats.length, first + pageSize);
			cards.clear(); beatsContainer.replaceChildren(); activeIndex = -1;
			// Only one bounded page exists in the DOM, even for a 50000-note score.
			for (let beatIndex = first; beatIndex < end; beatIndex++) {
				const beat = beats[beatIndex];
				const card = document.createElement("div");
				card.className = "ms-card"; card.dataset.index = String(beatIndex);
				const cardHeader = document.createElement("div");
				cardHeader.className = "ms-card-header";
				cardHeader.innerHTML = `<span class="ms-seq">${beatIndex + 1}/${beats.length}</span><span>${Number((beat.durationMs / 1000).toFixed(3))}s</span>`;
				const grid = document.createElement("div"); grid.className = "ms-grid";
				keyLayout.forEach((letter) => {
					const key = document.createElement("div"); key.className = "ms-key"; key.textContent = letter.toUpperCase();
					if (beat.notes.includes(letter)) key.classList.add("active-key");
					grid.appendChild(key);
				});
				card.append(cardHeader, grid); beatsContainer.appendChild(card); cards.set(beatIndex, card);
			}
			root.dataset.page = String(page + 1);
			previous.disabled = page === 0; next.disabled = page + 1 === pageCount;
			pageInput.value = String(page + 1);
			pageLabel.textContent = `第 ${page + 1} / ${pageCount} 页 · ${first + 1}–${end} / ${beats.length} 组`;
		}
		function updateFollow() {
			follow.textContent = following ? "跟随播放" : "回到播放位置";
			follow.setAttribute("aria-pressed", String(following));
		}
		function matchingSnapshot() {
			const value = player.getSnapshot();
			if (localSrc && value.src === localSrc) return value;
			return Object.freeze({ state: "stopped", index: 0, elapsedMs: 0,
				durationMs: localDuration, src: localSrc,
				title: container.dataset.title || "", instrument: value.instrument, loading: false, error: "", beatsCount: beats.length });
		}
		function clearActive() {
			const card = cards.get(activeIndex);
			card?.classList.remove("active"); card?.removeAttribute("aria-current");
		}
		function publishPlayback() {
			if (disposed) return;
			container.dispatchEvent(new CustomEvent("score:playback", { bubbles: true, detail: matchingSnapshot() }));
		}
		function update(snapshot, forceFollow = false) {
			if (disposed) return;
			instrumentSelect.disabled = snapshot.loading;
			instrumentSelect.value = snapshot.instrument;
			instrumentSelect.title = `切换音色：${snapshot.instrument === "piano" ? "钢琴" : "吉他"}`;
			instrumentSelect.setAttribute("aria-busy", String(snapshot.loading));
			audioStatus.textContent = snapshot.error || (snapshot.loading ? "正在准备播放器…" : "");
			const active = localSrc && snapshot.src === localSrc && ["playing", "paused"].includes(snapshot.state);
			const gridVisible = playbackHost.dataset.currentView !== "number";
			const targetPage = Math.floor(snapshot.index / pageSize);
			const changedPage = active && following && gridVisible && page !== targetPage;
			if (changedPage) renderPage(targetPage);
			if (!active) { clearActive(); activeIndex = -1; }
			else if (activeIndex !== snapshot.index || forceFollow) {
				clearActive(); activeIndex = snapshot.index;
				const card = cards.get(activeIndex);
				card?.classList.add("active"); card?.setAttribute("aria-current", "step");
				if (snapshot.state === "playing" && following && gridVisible && card?.getClientRects().length && (changedPage || forceFollow || performance.now() - lastFollowAt >= 250)) {
					lastFollowAt = performance.now(); card.scrollIntoView({ behavior: "smooth", block: "center" });
				}
			}
			publishPlayback();
		}
		function dispose() {
			if (disposed) return;
			disposed = true; unsubscribe(); events.abort(); observer.disconnect(); viewObserver.disconnect(); header.remove(); cards.clear();
			delete container.__musicSimPlayback;
			if (container.__musicSimCleanup === dispose) delete container.__musicSimCleanup;
		}
		Object.defineProperty(container, "__musicSimPlayback", { configurable: true, get: matchingSnapshot });
		container.__musicSimCleanup = dispose;
		renderPage(0); updateFollow();
		unsubscribe = player.subscribe(update);
		observer.observe(document.body, { childList: true, subtree: true });
		viewObserver.observe(playbackHost, { attributes: true, attributeFilter: ["data-current-view"] });
		playbackHost.addEventListener("score:playback-request", publishPlayback, { signal: events.signal });
		function browse(value) { following = false; updateFollow(); renderPage(value); update(player.getSnapshot()); }
		previous.addEventListener("click", () => browse(page - 1), { signal: events.signal });
		next.addEventListener("click", () => browse(page + 1), { signal: events.signal });
		pageInput.addEventListener("change", () => { const value = Number(pageInput.value); if (Number.isInteger(value)) browse(value - 1); else pageInput.value = String(page + 1); }, { signal: events.signal });
		follow.addEventListener("click", () => { following = true; updateFollow(); update(player.getSnapshot(), true); }, { signal: events.signal });
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
