/* 将谱子导出为可保存的 15 键格子谱长图。 */
(function () {
	"use strict";

	const WIDTH = 1200;
	const PADDING = 36;
	const GAP = 10;
	const HEADER_HEIGHT = 138;
	const PNG_MAX_HEIGHT = 12000;
	const LETTERS = "ABCDEFGHIJKLMNO";

	function escapeXml(value) {
		return String(value).replace(/[&<>"']/g, (character) => ({
			"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
		})[character]);
	}

	function readableAccentText(color) {
		const hex = String(color).match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
		const rgb = String(color).match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i);
		let channels;
		if (hex) {
			const expanded = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
			channels = [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16));
		} else if (rgb) channels = rgb.slice(1, 4).map(Number);
		if (!channels) return "#ffffff";
		const linear = channels.map((channel) => {
			const value = Math.max(0, Math.min(255, channel)) / 255;
			return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
		});
		const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
		return luminance > .18 ? "#162437" : "#ffffff";
	}

	function buildSvg(title, beats, options = {}) {
		const requestedColumns = Number(options.columns);
		const columns = Number.isFinite(requestedColumns) ? Math.max(2, Math.min(6, Math.round(requestedColumns))) : 4;
		const palette = {
			background: "#f5f8fc", foreground: "#243449", accent: "#327faf",
			surface: "#ffffff", border: "#d5e0ea", ...options.palette,
		};
		// A partial theme still gets a matching surface instead of a white card.
		if (options.palette) palette.surface = options.palette.surface || options.palette.background || palette.background;
		palette.border ||= palette.foreground;
		const colors = Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, escapeXml(value)]));
		const activeText = readableAccentText(palette.accent);
		const rows = Math.ceil(beats.length / columns);
		const cardWidth = (WIDTH - PADDING * 2 - GAP * (columns - 1)) / columns;
		const cellWidth = (cardWidth - 20 - 4 * 3) / 5;
		const cardHeight = 27 + cellWidth * 3 + 3 * 2 + 10;
		const rowHeight = cardHeight + GAP;
		const height = Math.ceil(HEADER_HEIGHT + rows * rowHeight + 56);
		const keyFontSize = Math.min(18, Math.max(10, cellWidth * .3));
		const parts = [
			`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">`,
			`<title>${escapeXml(title)} · 格子谱</title>`,
			`<desc>15 键格子谱，共 ${beats.length} 拍，每行 ${columns} 组，按从左到右、从上到下的顺序阅读。</desc>`,
			`<rect width="${WIDTH}" height="${height}" fill="${colors.background}"/>`,
			`<rect x="0" y="0" width="${WIDTH}" height="${HEADER_HEIGHT - 10}" fill="${colors.surface}"/>`,
			`<text x="${PADDING}" y="45" fill="${colors.accent}" font-size="16" font-weight="700" font-family="system-ui,-apple-system,sans-serif">光·遇 · 15 键格子谱</text>`,
			`<text x="${PADDING}" y="87" fill="${colors.foreground}" font-size="27" font-weight="700" font-family="system-ui,-apple-system,sans-serif">${escapeXml(Array.from(title).slice(0, 46).join(""))}</text>`,
			`<text x="${PADDING}" y="113" fill="${colors.foreground}" fill-opacity=".75" font-size="14" font-family="system-ui,-apple-system,sans-serif">共 ${beats.length} 拍 · 从左到右、从上到下阅读 · 高亮格子为按键</text>`,
		];

		beats.forEach((beat, index) => {
			const column = index % columns;
			const row = Math.floor(index / columns);
			const x = PADDING + column * (cardWidth + GAP);
			const y = HEADER_HEIGHT + row * rowHeight;
			const activeNotes = new Set(beat.notes.map((note) => note.toUpperCase()));
			parts.push(`<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="10" fill="${colors.surface}" stroke="${colors.border}"/>`);
			parts.push(`<text x="${x + 10}" y="${y + 18}" fill="${colors.accent}" font-size="11" font-weight="700" font-family="system-ui,-apple-system,sans-serif">${index + 1}</text>`);
			parts.push(`<text x="${x + cardWidth - 10}" y="${y + 18}" text-anchor="end" fill="${colors.foreground}" fill-opacity=".7" font-size="10" font-family="system-ui,-apple-system,sans-serif">${(beat.durationMs / 1000).toFixed(2)}s</text>`);
			for (let keyIndex = 0; keyIndex < 15; keyIndex += 1) {
				const letter = LETTERS[keyIndex];
				const keyX = x + 10 + (keyIndex % 5) * (cellWidth + 3);
				const keyY = y + 27 + Math.floor(keyIndex / 5) * (cellWidth + 3);
				const active = activeNotes.has(letter);
				parts.push(`<rect x="${keyX}" y="${keyY}" width="${cellWidth}" height="${cellWidth}" rx="4" fill="${active ? colors.accent : colors.background}" stroke="${active ? colors.accent : colors.border}"/>`);
				parts.push(`<text x="${keyX + cellWidth / 2}" y="${keyY + cellWidth / 2}" dominant-baseline="middle" text-anchor="middle" fill="${active ? activeText : colors.foreground}" fill-opacity="${active ? 1 : .7}" font-size="${keyFontSize}" font-weight="700" font-family="system-ui,-apple-system,sans-serif">${letter}</text>`);
			}
		});
		parts.push(`<text x="${PADDING}" y="${height - 22}" fill="${colors.foreground}" fill-opacity=".7" font-size="13" font-family="system-ui,-apple-system,sans-serif">muios.bbroot.com · 格子谱长图</text>`);
		parts.push("</svg>");
		return { blob: new Blob(parts, { type: "image/svg+xml;charset=utf-8" }), width: WIDTH, height, columns };
	}

	async function svgToPng(svgBlob, height) {
		const svgUrl = URL.createObjectURL(svgBlob);
		try {
			const image = new Image();
			await new Promise((resolve, reject) => {
				image.onload = resolve;
				image.onerror = () => reject(new Error("长图渲染失败"));
				image.src = svgUrl;
			});
			const canvas = document.createElement("canvas");
			canvas.width = WIDTH;
			canvas.height = height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("浏览器无法创建长图画布");
			context.drawImage(image, 0, 0);
			return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
		} finally {
			URL.revokeObjectURL(svgUrl);
		}
	}

	function saveBlob(blob, name) {
		const objectUrl = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = objectUrl;
		link.download = name;
		link.style.display = "none";
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
	}

	async function download({ title, src, palette, columns }) {
		if (!window.MusicSim?.parseBeats) throw new Error("琴谱解析器尚未准备好");
		const response = await fetch(src, { cache: "force-cache" });
		if (!response.ok) throw new Error(`琴谱文件下载失败（HTTP ${response.status}）`);
		const beats = window.MusicSim.parseBeats(await response.text());
		if (!beats.length) throw new Error("这份琴谱没有可导出的按键数据");
		const { blob: svgBlob, height } = buildSvg(title, beats, { palette, columns });
		let output = svgBlob;
		let format = "SVG";
		if (height <= PNG_MAX_HEIGHT) {
			try {
				const png = await svgToPng(svgBlob, height);
				if (png) {
					output = png;
					format = "PNG";
				}
			} catch (error) {
				console.warn("PNG 导出失败，改用 SVG 长图", error);
			}
		}
		const safeTitle = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80) || "琴谱";
		saveBlob(output, `${safeTitle}-格子谱.${format.toLowerCase()}`);
		return { format, beats: beats.length };
	}

	window.ScoreGridExport = { download, buildSvg };
})();
