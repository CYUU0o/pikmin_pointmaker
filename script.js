/* =========================================================
   全域變數設定
   ========================================================= */

let map;
let overlay = null;
let overlayCenter = null; // 圖片原始中心
let overlayScale = 1;
let overlayRatio = 1;
let overlayOffset = { x: 0, y: 0 };
let originalImg = { w: 1, h: 1 };

let markers = [];
let polyline = null;
let selectedMarker = null;


/* =========================================================
   初始化
   ========================================================= */

window.onload = initMap;

/* -------------------------
   地圖初始化
------------------------- */

function initMap() {

    map = L.map('map').setView([25.033, 121.5654], 17);

    L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 22 }
    ).addTo(map);

    map.on("click", e => addPoint(e.latlng));

    map.on("click", function(){
        removeMarkerMenu();
    });

    document.getElementById("img").addEventListener("change", uploadImage);
    document.getElementById("loadBtn").addEventListener("click", loadCoordinates);
    document.getElementById("exportBtn").addEventListener("click", exportGPX);

    setupSliders();
}


/* =========================================================
   Overlay 圖片系統
   ========================================================= */

/* -------------------------
   上傳圖片
------------------------- */

function uploadImage(e) {

    const file = e.target.files[0];
    if (!file) {
        alert("請選擇圖片");
        return;
    }

    const reader = new FileReader();

    reader.onload = function (ev) {

        const imgUrl = ev.target.result;
        const img = new Image();

        img.onload = function () {

            originalImg.w = img.width;
            originalImg.h = img.height;

            overlayCenter = map.getCenter();
            overlayOffset = { x: 0, y: 0 };

            overlayScale = 1;
            overlayRatio = 1;

            if (overlay) map.removeLayer(overlay);

            overlay = L.imageOverlay(
                imgUrl,
                computeBounds(overlayCenter)
            ).addTo(map);

            updateOverlayTransform();

            alert("圖片載入成功，可用滑桿控制移動/縮放/比例微調");
        };

        img.src = imgUrl;
    };

    reader.readAsDataURL(file);
}


/* -------------------------
   計算圖片初始範圍
------------------------- */

function computeBounds(center) {

    const latDiff = 0.003;
    const lngDiff = latDiff * (originalImg.w / originalImg.h);

    return [
        [center.lat - latDiff, center.lng - lngDiff],
        [center.lat + latDiff, center.lng + lngDiff]
    ];
}


/* -------------------------
   更新圖片位置與縮放
------------------------- */

function updateOverlayTransform() {

    if (!overlay || !overlayCenter) return;

    const centerLat = overlayCenter.lat + overlayOffset.y;
    const centerLng = overlayCenter.lng + overlayOffset.x;

    const latSize = 0.003 * overlayScale;
    const lngSize = latSize * (originalImg.w / originalImg.h) * overlayRatio;

    const nw = [centerLat + latSize, centerLng - lngSize];
    const se = [centerLat - latSize, centerLng + lngSize];

    overlay.setBounds([nw, se]);
}


/* =========================================================
   滑桿控制系統
   ========================================================= */

function setupSliders() {

    const OFFSET_MAX = 0.005;
    const OFFSET_STEP = 0.00001;

    /* -------------------------
       圖片 XY 位移控制
    ------------------------- */

    ["x", "y"].forEach(axis => {

        const s = document.getElementById(axis + "Slider");
        const i = document.getElementById(axis + "Input");

        s.min = -OFFSET_MAX;
        s.max = OFFSET_MAX;
        s.step = OFFSET_STEP;

        i.min = -OFFSET_MAX;
        i.max = OFFSET_MAX;
        i.step = OFFSET_STEP;

        s.addEventListener("input", () => {

            overlayOffset[axis] = parseFloat(s.value);
            i.value = s.value;

            updateOverlayTransform();
        });

        i.addEventListener("change", () => {

            overlayOffset[axis] = parseFloat(i.value);
            s.value = i.value;

            updateOverlayTransform();
        });

    });


    /* -------------------------
       圖片縮放控制
    ------------------------- */

    const scaleSlider = document.getElementById("scaleSlider");
    const scaleInput = document.getElementById("scaleInput");

    scaleSlider.addEventListener("input", () => {

        overlayScale = parseFloat(scaleSlider.value) / 100;
        scaleInput.value = scaleSlider.value;

        updateOverlayTransform();
    });

    scaleInput.addEventListener("change", () => {

        let val = parseFloat(scaleInput.value);

        if (val < 10) val = 10;
        if (val > 500) val = 500;

        overlayScale = val / 100;
        scaleSlider.value = val;

        updateOverlayTransform();
    });


    /* -------------------------
       圖片比例微調
    ------------------------- */

    const ratioSlider = document.getElementById("ratioSlider");
    const ratioInput = document.getElementById("ratioInput");

    ratioSlider.addEventListener("input", () => {

        overlayRatio = parseFloat(ratioSlider.value) / 100;
        ratioInput.value = ratioSlider.value;

        updateOverlayTransform();
    });

    ratioInput.addEventListener("change", () => {

        let val = parseFloat(ratioInput.value);

        if (val < 50) val = 50;
        if (val > 200) val = 200;

        overlayRatio = val / 100;
        ratioSlider.value = val;

        updateOverlayTransform();
    });


    /* -------------------------
       圖片透明度
    ------------------------- */

    const opacitySlider = document.getElementById("opacitySlider");
    const opacityInput = document.getElementById("opacityInput");

    opacitySlider.addEventListener("input", () => {

        const val = parseFloat(opacitySlider.value) / 100;
        opacityInput.value = opacitySlider.value;

        if (overlay) overlay.setOpacity(val);
    });

    opacityInput.addEventListener("change", () => {

        let val = parseFloat(opacityInput.value);

        if (val < 0) val = 0;
        if (val > 100) val = 100;

        opacitySlider.value = val;

        if (overlay) overlay.setOpacity(val / 100);
    });

}


/* =========================================================
   Marker 系統
   ========================================================= */

/* -------------------------
   新增 Marker
------------------------- */

function addPoint(latlng) {

    const marker = L.marker(latlng, {
        draggable: false,
        icon: L.icon({
            iconUrl: "img/marker_1.png",
            iconSize: [26, 26],
            iconAnchor: [13, 26]
        })
    }).addTo(map);


    /* 範圍圈 */

    const circle = L.circle(latlng, {
        radius: 40.5,
        color: "#888",
        weight: 1,
        dashArray: "5,5",
        fill: false,
        interactive: false
    }).addTo(map);

    circle.bringToBack();

    marker.circle = circle;

    marker.on("click", () => showMarkerMenu(marker));

    marker.on("move", e => {
        if (marker.circle) marker.circle.setLatLng(e.latlng);
    });

    markers.push(marker);

    drawLine();
}


/* -------------------------
   繪製路徑線
------------------------- */

function drawLine() {

    if (polyline) map.removeLayer(polyline);

    const latlngs = markers.map(m => m.getLatLng());

    if (latlngs.length > 1) {
        polyline = L.polyline(latlngs, { color: "red" }).addTo(map);
    }

}


/* =========================================================
   Marker 選單系統
   ========================================================= */

/* -------------------------
   顯示 Marker 選單
------------------------- */

function showMarkerMenu(marker) {

    removeMarkerMenu();

    selectedMarker = marker;

    const index = markers.indexOf(marker);

    const menu = document.createElement("div");

    menu.className = "marker-menu";

    menu.innerHTML = `
        <button onclick="enableMove(${index})">移動</button>
        <button onclick="deletePoint(${index})">刪除</button>
    `;

    menu.addEventListener("click", e => e.stopPropagation());

    map.getContainer().appendChild(menu);

    const pos = map.latLngToContainerPoint(marker.getLatLng());

    menu.style.position = "absolute";
    menu.style.left = (pos.x - 30) + "px";
    menu.style.top = (pos.y + 30) + "px";
    menu.style.zIndex = 9999;

    marker.menuDiv = menu;
}


/* -------------------------
   移除 Marker 選單
------------------------- */

function removeMarkerMenu() {

    if (selectedMarker && selectedMarker.menuDiv) {

        selectedMarker.menuDiv.remove();
        selectedMarker.menuDiv = null;
    }

    selectedMarker = null;
}

map.on("click", removeMarkerMenu);


/* -------------------------
   移動 Marker
------------------------- */

function enableMove(i) {

    const m = markers[i];

    removeMarkerMenu();

    m.dragging.enable();

    if (m._icon) m._icon.classList.add("moving");

    m.once("dragend", () => {

        m.dragging.disable();

        if (m._icon) m._icon.classList.remove("moving");

        if (m.circle) m.circle.setLatLng(m.getLatLng());

        drawLine();
    });

}


/* -------------------------
   刪除 Marker
------------------------- */

function deletePoint(i) {

    const m = markers[i];

    if (m.circle) map.removeLayer(m.circle);

    map.removeLayer(m);

    markers.splice(i, 1);

    drawLine();

    removeMarkerMenu();
}


/* =========================================================
   GPX 匯出系統
   ========================================================= */

function exportGPX() {

    if (markers.length === 0) {
        alert("沒有任何路線點");
        return;
    }

    let gpx =
`<?xml version="1.0"?>
<gpx version="1.1" creator="Pikmin Bloom Route Tool"
xmlns="http://www.topografix.com/GPX/1/1">
<trk><trkseg>\n`;

    markers.forEach(m => {

        const ll = m.getLatLng();

        gpx += `<trkpt lat="${ll.lat}" lon="${ll.lng}"></trkpt>\n`;

    });

    gpx += "</trkseg></trk></gpx>";

    const blob = new Blob([gpx], { type: "application/gpx+xml" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "route.gpx";

    a.click();
}


/* =========================================================
   座標載入系統
   ========================================================= */

function loadCoordinates() {

    const text = document.getElementById("coords").value.trim();

    const parts = text.split(",");

    if (parts.length !== 2) {
        alert("座標格式錯誤");
        return;
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lng)) {
        alert("座標解析失敗");
        return;
    }

    map.setView([lat, lng], 18);

    if (overlayCenter) {
        overlayCenter = { lat, lng };
        updateOverlayTransform();
    }
}