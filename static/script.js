/* ================= 1. GLOBAL INITIALIZATION ================= */
const svgNS = "http://www.w3.org/2000/svg";
const $ = id => document.getElementById(id);
let loads = [];


/* ================= 2. DRAW HELPERS ================= */
function drawLine(svg, x1, y1, x2, y2, c="black", w=2) {
    const l = document.createElementNS(svgNS, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    l.setAttribute("stroke", c); l.setAttribute("stroke-width", w);
    svg.appendChild(l);
}

function drawArrow(svg, x1, y1, x2, y2, c="red") {
    drawLine(svg, x1, y1, x2, y2, c, 3);
    const a = Math.atan2(y2 - y1, x2 - x1), s = 8;
    const h = document.createElementNS(svgNS, "polygon");
    h.setAttribute("points", `
        ${x2},${y2}
        ${x2 - s * Math.cos(a - Math.PI / 6)},${y2 - s * Math.sin(a - Math.PI / 6)}
        ${x2 - s * Math.cos(a + Math.PI / 6)},${y2 - s * Math.sin(a + Math.PI / 6)}
    `);
    h.setAttribute("fill", c);
    svg.appendChild(h);
}

function drawMoment(svg, x, y, M) {
    const r = 18;
    const clockwise = M < 0;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", clockwise 
        ? `M ${x - r},${y} A ${r},${r} 0 1 1 ${x + r},${y}` 
        : `M ${x + r},${y} A ${r},${r} 0 1 0 ${x - r},${y}`);
    path.setAttribute("stroke", "green");
    path.setAttribute("stroke-width", "3");
    path.setAttribute("fill", "none");
    svg.appendChild(path);

    const ax = clockwise ? x + r : x - r;
    drawArrow(svg, ax, y - 4, ax + (clockwise ? 10 : -10), y, "green");
}

function drawText(svg, x, y, t, c="black") {
    const e = document.createElementNS(svgNS, "text");
    e.setAttribute("x", x); e.setAttribute("y", y);
    e.setAttribute("text-anchor", "middle"); e.setAttribute("font-size", "12");
    e.setAttribute("fill", c); e.textContent = t;
    svg.appendChild(e);
}

/* ================= 3. BEAM SUPPORTS & DRAWING ================= */
function drawPin(svg, x, y) {
    const p = document.createElementNS(svgNS, "polygon");
    p.setAttribute("points", `${x},${y} ${x - 15},${y + 25} ${x + 15},${y + 25}`);
    p.setAttribute("fill", "#555");
    svg.appendChild(p);
}

function drawRoller(svg, x, y) {
    drawPin(svg, x, y);
    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", x); c.setAttribute("cy", y + 35); c.setAttribute("r", 6);
    c.setAttribute("fill", "#333");
    svg.appendChild(c);
}

function drawFixed(svg, x, y, left = true) {
    const r = document.createElementNS(svgNS, "rect");
    r.setAttribute("x", left ? x - 6 : x); r.setAttribute("y", y - 20);
    r.setAttribute("width", 6); r.setAttribute("height", 40); r.setAttribute("fill", "#444");
    svg.appendChild(r);
}

function drawBeam(L) {
    const svg = $("beamCanvas");
    if (!svg || !L || L <= 0) return;
    svg.innerHTML = "";

    const beamType = $("beamType").value;
    const width = 700, offset = 50, y = 100;
    const sx = x => offset + (x / L) * width;

    drawLine(svg, offset, y, offset + width, y, "black", 4);

    if (beamType === "simply_supported") { drawPin(svg, sx(0), y); drawRoller(svg, sx(L), y); }
    else if (beamType === "cantilever") { drawFixed(svg, sx(0), y, true); }
    else if (beamType === "fixed_fixed") { drawFixed(svg, sx(0), y, true); drawFixed(svg, sx(L), y, false); }
    else if (beamType === "overhang") {
        const Lo = +$("overhangLength").value;
        if (Lo > 0 && Lo < L) {
            const r = L - Lo;
            drawPin(svg, sx(0), y); drawRoller(svg, sx(r), y);
        }
    }

    loads.forEach(ld => {
        if (ld.type === "point") {
            drawArrow(svg, sx(ld.x), y - 45, sx(ld.x), y, "red");
            drawText(svg, sx(ld.x), y - 55, `${ld.P} kN`, "red");
        } else if (ld.type === "udl") {
            for (let i = 0; i <= 10; i++) {
                const xi = ld.x1 + (i / 10) * (ld.x2 - ld.x1);
                drawArrow(svg, sx(xi), y - 35, sx(xi), y, "blue");
            }
            drawText(svg, sx((ld.x1 + ld.x2) / 2), y - 45, `${ld.w} kN/m`, "blue");
        } else if (ld.type === "moment") {
            drawMoment(svg, sx(ld.x), y - 10, ld.M);
        } else if (ld.type === "uvl") {
            const steps = 10;
            const maxVisualHeight = 50; // Maximum height in pixels for the largest load
            
            // Find the larger magnitude to normalize the arrow scaling
            const maxW = Math.max(Math.abs(ld.w1), Math.abs(ld.w2), 1);

            for (let i = 0; i <= steps; i++) {
                const xi = ld.x1 + (i / steps) * (ld.x2 - ld.x1);
                const wi = ld.w1 + (i / steps) * (ld.w2 - ld.w1);
                
                // Calculate relative height based on current intensity
                const arrowHeight = (wi / maxW) * maxVisualHeight;
                
                // Draw arrow from (y - arrowHeight) down to the beam at (y)
                // If wi is positive, arrow points down. If negative, it points up.
                drawArrow(svg, sx(xi), y - arrowHeight, sx(xi), y, "purple");
            }
        }
    });
}

function redraw() { 
    const L = parseFloat($("length").value);
    drawBeam(L); 
}

/* ================= 4. LOAD MANAGEMENT (GLOBAL) ================= */
function addPointLoad() {
    const x = parseFloat($("pl_x").value);
    const p = parseFloat($("pl_p").value);
    const angle = parseFloat($("pl_angle").value) || 90;

    if (isNaN(x) || isNaN(p)) { alert("Please enter Position and Magnitude."); return; }
    loads.push({ type: "point", x, P: p, angle });
    $("pl_x").value = ""; $("pl_p").value = "";
    updateLoadTable(); redraw();
}

function addUDL() {
    const x1 = parseFloat($("udl_x1").value);
    const x2 = parseFloat($("udl_x2").value);
    const w = parseFloat($("udl_w").value);

    if (isNaN(x1) || isNaN(x2) || isNaN(w)) { alert("Please enter valid UDL values."); return; }
    loads.push({ type: "udl", x1, x2, w });
    updateLoadTable(); redraw();
}

function addMoment() {
    const x = parseFloat($("m_x").value);
    const m = parseFloat($("m_val").value);

    if (isNaN(x) || isNaN(m)) { alert("Please enter valid Moment values."); return; }
    loads.push({ type: "moment", x, M: m });
    updateLoadTable(); redraw();
}
function addUVL() {
    const x1 = parseFloat($("uvl_x1").value);
    const x2 = parseFloat($("uvl_x2").value);
    const w1 = parseFloat($("uvl_w1").value);
    const w2 = parseFloat($("uvl_w2").value);
    if (isNaN(x1) || isNaN(x2) || isNaN(w1) || isNaN(w2)) { alert("Please enter valid UVL values."); return; }
    loads.push({ type: "uvl", x1, x2, w1, w2 });
    updateLoadTable(); redraw();
}

function deleteLoad(index) {
    loads.splice(index, 1);
    updateLoadTable(); redraw();
}

function updateLoadTable() {
    const tb = $("loadTableBody");
    if (!tb) return;
    tb.innerHTML = loads.length === 0 
        ? `<tr><td colspan="4" style="text-align:center;">No loads added</td></tr>` 
        : "";

    loads.forEach((l, i) => {
        let desc = l.type === "point" ? `${l.P} kN at ${l.x} m` 
                 : l.type === "udl" ? `${l.w} kN/m (${l.x1}-${l.x2} m)` 
                 : l.type === "uvl" ? `From ${l.w1} to ${l.w2} kN/m (${l.x1}-${l.x2} m)`
                 : `${l.M} kNm at ${l.x} m`;
        tb.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${i + 1}</td>
                <td style="text-transform: capitalize;">${l.type}</td>
                <td>${desc}</td>
                <td><button style="color:red; cursor:pointer;" onclick="deleteLoad(${i})">Delete</button></td>
            </tr>`);
    });
}

/* ================= 5. SOLVER & DIALOGS ================= */
function solveBeam() {
    const payload = {
        beamType: $("beamType").value,
        beam: { length: +$("length").value, E: +$("E").value, I: +$("I").value },
        loads: loads
    };
    if (payload.beamType === "overhang") payload.overhangLength = +$("overhangLength").value;

    fetch("/solve", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(d => {
        if (d.error) { alert(d.error); return; }
        
        // CRITICAL: Save data to global variable for the slider to use
        currentDeflectionData = d; 

       //  Plotly calls with merged Layout objects
        Plotly.newPlot("sfd", [{ x: d.x, y: d.shear }], { 
            title: "Shear Force Diagram",
            xaxis: { title: 'Length (m)' }, 
            yaxis: { title: 'Shear Force (kN)' }
        });

        Plotly.newPlot("bmd", [{ x: d.x, y: d.moment }], { 
            title: "Bending Moment Diagram",
            xaxis: { title: 'Length (m)' }, 
            yaxis: { title: 'Bending Moment (kNm)' }
        });

        Plotly.newPlot("deflection", [{ x: d.x, y: d.deflection }], { 
            title: "Deflection Diagram",
            xaxis: { title: 'Length (m)' }, 
            yaxis: { title: 'Deflection (m)' }
        });
        // Update reactions text
        $("reactions").innerHTML = `R<sub>A</sub> = ${d.reactions.RA.toFixed(2)} kN, R<sub>B</sub> = ${d.reactions.RB.toFixed(2)} kN`;
        // Reset animation state
        animRunning = false;
        animTime = 0;
        $("animToggleBtn").innerHTML = "▶ Play deflection";
        const gradient = document.getElementById("beamGradient");

    });
}
function openFeaturesDialog() { $("featuresDialog").classList.remove("hidden"); }
function closeFeaturesDialog() { $("featuresDialog").classList.add("hidden"); }
function openInfoDialog() { $("infoDialog").classList.remove("hidden"); }
function closeInfoDialog() { $("infoDialog").classList.add("hidden"); }
function openContactDialog() { $("contactDialog").classList.remove("hidden"); }
function closeContactDialog() { $("contactDialog").classList.add("hidden"); }

/* ================= 6. INITIALIZATION ================= */
document.addEventListener("DOMContentLoaded", () => {
    // Single consolidated tab switcher listener
    document.querySelectorAll(".load-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute('data-target');
            document.querySelectorAll(".load-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".load-window").forEach(w => w.style.display = "none");
            tab.classList.add("active");
            if ($(targetId)) $(targetId).style.display = "block";
        });
    });

    const beamTypeEl = $("beamType");
    if (beamTypeEl) {
        beamTypeEl.addEventListener("change", () => {
            const config = $("overhang-config");
            if (beamTypeEl.value === "overhang") config.classList.remove("hidden");
            else config.classList.add("hidden");
            redraw();
        });
    }

    // Modal click-outside logic
    document.addEventListener("click", e => {
        document.querySelectorAll(".modal").forEach(modal => {
            if (!modal.classList.contains("hidden") && e.target === modal) modal.classList.add("hidden");
        });
    });

    redraw(); // Initial draw
});
/* ================= BEAMWORKS CORE ANIMATION SCRIPT ================= */

// Global state management
let currentDeflectionData = null;
let animationId = null;
let animRunning = false;
let animTime = 0;

/**
 * Main toggle for the animation system
 */
function toggleModeAnimation() {
    if (!currentDeflectionData || !currentDeflectionData.deflection) {
        alert("Solve the beam first to generate deformation shape.");
        return;
    }

    if (animRunning) {
        pauseModeAnimation();
    } else {
        startModeAnimation();
    }
}

/**
 * Starts the high-fidelity ribbon animation
 */
function startModeAnimation() {
    animRunning = true;
    const btn = document.getElementById("animToggleBtn");
    if (btn) btn.innerHTML = "⏸ Pause Animation";

    const xVals = currentDeflectionData.x;
    const wVals = currentDeflectionData.deflection;
    const L = parseFloat(document.getElementById("length").value);

    // Normalize deflection for visual consistency
    const maxDef = Math.max(...wVals.map(v => Math.abs(v))) || 1;
    const phi = wVals.map(v => v / maxDef); 

    // Visualization constants
    const width = 700;
    const offsetX = 50;
    const midY = 130;
    const amplitude = 60;          // Maximum visual swing in pixels
    const omega = 0.3 * Math.PI;   // Oscillation speed
    const beamThickness = 6;      // Thickness of the I-beam profile

    const path = document.getElementById("deflectionPath");

    function animate() {
        if (!animRunning) return;
        
        const factor =  - Math.abs(Math.sin(omega * animTime));
        let topPoints = [];
        let bottomPoints = [];

        for (let i = 0; i < xVals.length; i++) {
            const x = offsetX + (xVals[i] / L) * width;
            const dy = amplitude * phi[i] * factor;
            const currentY = midY + dy;

            // Generate ribbon coordinates
            topPoints.push(`${x},${currentY - beamThickness / 2}`);
            bottomPoints.unshift(`${x},${currentY + beamThickness / 2}`); // Reverse for closing the path
        }

        // Construct a single closed SVG path
        const d = `M ${topPoints.join(" L ")} L ${bottomPoints.join(" L ")} Z`;
        
        path.setAttribute("d", d);
        path.setAttribute("fill", "url(#beamGradient)"); // Uses the SVG <defs> gradient
        path.setAttribute("stroke", "#787a80ff");
        path.setAttribute("stroke-width", "1");

        animTime += 0.02;
        animationId = requestAnimationFrame(animate);
    }

    animate();
}


function pauseModeAnimation() {
    animRunning = false;
    const btn = document.getElementById("animToggleBtn");
    if (btn) btn.innerHTML = "▶ Play Deflection";

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}


function updateSolverData(data) {
    currentDeflectionData = data;
    // Reset animation state for new data
    animTime = 0;
    if (animRunning) {
        pauseModeAnimation();
        startModeAnimation();
    }
}


//  here 

