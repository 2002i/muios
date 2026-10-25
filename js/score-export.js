/* 将谱子导出为可保存的 15 键格子谱长图。 */
(function () {
	"use strict";

	const WIDTH = 1200;
	const COLUMNS = 6;
	const PADDING = 36;
	const GAP = 10;
	const HEADER_HEIGHT = 138;
	const ROW_HEIGHT = 118;
	const CARD_HEIGHT = 108;
	const PNG_MAX_HEIGHT = 12000;
	const LETTERS = "ABCDEFGHIJKLMNO";

	function escapeXml(value) {
		return String(value).replace(/[&<>"']/g, (character) => ({
			"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
		})[character]);
	}

	function buildSvg(title, beats) {
		const rows = Math.ceil(beats.length / COLUMNS);
		const height = HEADER_HEIGHT + rows * ROW_HEIGHT + 56;
		const cardWidth = (WIDTH - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
		const cellWidth = (cardWidth - 20 - 4 * 3) / 5;
		const parts = [
			`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">`,
			`<title>${escapeXml(title)} · 格子谱</title>`,
			`<desc>15 键格子谱，共 ${beats.length} 拍，按从左到右、从上到下的顺序阅读。</desc>`,
			`<rect width="${WIDTH}" height="${height}" fill="#f5f8fc"/>`,
			`<rect x="0" y="0" width="${WIDTH}" height="${HEADER_HEIGHT - 10}" fill="#162437"/>`,
			`<text x="${PADDING}" y="45" fill="#83c7f5" font-size="16" font-weight="700" font-family="system-ui,-apple-system,sans-serif">光·遇 · 15 键格子谱</text>`,
			`<text x="${PADDING}" y="87" fill="#ffffff" font-size="27" font-weight="700" font-family="system-ui,-apple-system,sans-serif">${escapeXml(Array.from(title).slice(0, 46).join(""))}</text>`,
			`<text x="${PADDING}" y="113" fill="#b9c9d9" font-size="14" font-family="system-ui,-apple-system,sans-serif">共 ${beats.length} 拍 · 从左到右、从上到下阅读 · 蓝色格子为按键</text>`,
		];

		beats.forEach((beat, index) => {
			const column = index % COLUMNS;
			const row = Math.floor(index / COLUMNS);
			const x = PADDING + column * (cardWidth + GAP);
			const y = HEADER_HEIGHT + row * ROW_HEIGHT;
			const activeNotes = new Set(beat.notes.map((note) => note.toUpperCase()));
			parts.push(`<rect x="${x}" y="${y}" width="${cardWidth}" height="${CARD_HEIGHT}" rx="10" fill="#ffffff" stroke="#d5e0ea"/>`);
			parts.push(`<text x="${x + 10}" y="${y + 18}" fill="#327faf" font-size="11" font-weight="700" font-family="system-ui,-apple-system,sans-serif">${index + 1}</text>`);
			parts.push(`<text x="${x + cardWidth - 10}" y="${y + 18}" text-anchor="end" fill="#718295" font-size="10" font-family="system-ui,-apple-system,sans-serif">${(beat.durationMs / 1000).toFixed(2)}s</text>`);
			for (let keyIndex = 0; keyIndex < 15; keyIndex += 1) {
				const letter = LETTERS[keyIndex];
				const keyX = x + 10 + (keyIndex % 5) * (cellWidth + 3);
				const keyY = y + 27 + Math.floor(keyIndex / 5) * 25;
				const active = activeNotes.has(letter);
				parts.push(`<rect x="${keyX}" y="${keyY}" width="${cellWidth}" height="22" rx="4" fill="${active ? "#2c96cc" : "#edf3f8"}" stroke="${active ? "#2c96cc" : "#dce6ef"}"/>`);
				parts.push(`<text x="${keyX + cellWidth / 2}" y="${keyY + 15}" text-anchor="middle" fill="${active ? "#ffffff" : "#7a8da0"}" font-size="10" font-weight="700" font-family="system-ui,-apple-system,sans-serif">${letter}</text>`);
			}
		});
		parts.push(`<text x="${PADDING}" y="${height - 22}" fill="#7a8da0" font-size="13" font-family="system-ui,-apple-system,sans-serif">muios.bbroot.com · 格子谱长图</text>`);
		parts.push("</svg>");
		return { blob: new Blob(parts, { type: "image/svg+xml;charset=utf-8" }), height };
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

	async function download({ title, src }) {
		if (!window.MusicSim?.parseBeats) throw new Error("琴谱解析器尚未准备好");
		const response = await fetch(src, { cache: "force-cache" });
		if (!response.ok) throw new Error(`琴谱文件下载失败（HTTP ${response.status}）`);
		const beats = window.MusicSim.parseBeats(await response.text());
		if (!beats.length) throw new Error("这份琴谱没有可导出的按键数据");
		const { blob: svgBlob, height } = buildSvg(title, beats);
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

	window.ScoreGridExport = { download };
})();
