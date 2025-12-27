import numpy as np

# ==========================================================
# SOLVER CORE
# ==========================================================
def _beam_response(L, loads, RA, MA, E, I,
                   fixed_left=False, fixed_right=False):
    """
    Generic beam response solver using numerical integration
    """

    x = np.linspace(0, L, 600)
    dx = x[1] - x[0]

    # Initial internal forces
    V = np.ones_like(x) * RA
    M = RA * x + MA

    # ---------------- Load contributions ----------------
    for load in loads:

        # Point load
        if load["type"] == "point":
            P, a = load["P"], load["x"]
            V[x >= a] -= P
            M[x >= a] -= P * (x[x >= a] - a)

        # UDL
        elif load["type"] == "udl":
            w, x1, x2 = load["w"], load["x1"], load["x2"]
            dx_udl = np.clip(x - x1, 0, x2 - x1)
            V -= w * dx_udl
            M -= w * dx_udl**2 / 2
            idx = x >= x2
            M[idx] -= w * (x[idx] - x2) * (x2 - x1)
        
        # Applied moment
        elif load["type"] == "moment":
            a, M0 = load["x"], load["M"]
            M[x >= a] -= M0
        
        # Trapezoidal UDL
        elif load["type"] == "uvl":
            w1, w2, x1, x2 = load["w1"], load["w2"], load["x1"], load["x2"]
            for i in range(len(x)):
                if x[i] < x1:
                    continue
                elif x1 <= x[i] <= x2:
                    wi = w1 + (w2 - w1) * (x[i] - x1) / (x2 - x1)
                    dx_udl = x[i] - x1
                    V[i] -= 0.5 * (w1 + wi) * dx_udl
                    M[i] -= ( (w1 + wi) / 2 ) * dx_udl**2 / 2
                else:  # x[i] > x2
                    W_total = 0.5 * (w1 + w2) * (x2 - x1)
                    V[i] -= W_total
                    M[i] -= W_total * ( (x1 + x2) / 2 - x1 )


    # ---------------- Deflection ----------------
    curvature = M / (E * I)
    slope = np.cumsum(curvature) * dx
    w = np.cumsum(slope) * dx

    # ---------------- Boundary conditions ----------------
    if fixed_left:
        slope -= slope[0]
        w -= w[0]

    if fixed_right:
        w -= (x / L) * w[-1]

    return x, V, M, w


# ==========================================================
# SIMPLY SUPPORTED BEAM
# ==========================================================
def solve_simply_supported(L, loads, E=210e9, I=8e-6):

    total_force = 0.0
    total_moment = 0.0

    for load in loads:
        if load["type"] == "point":
            total_force += load["P"]
            total_moment += load["P"] * load["x"]

        elif load["type"] == "udl":
            w, x1, x2 = load["w"], load["x1"], load["x2"]
            W = w * (x2 - x1)
            xc = 0.5 * (x1 + x2)
            total_force += W
            total_moment += W * xc

        elif load["type"] == "moment":
            total_moment += load["M"]

    RB = total_moment / L
    RA = total_force - RB

    x, V, M, w = _beam_response(L, loads, RA, 0.0, E, I)

    # enforce w(L)=0
    w -= (x / L) * w[-1]

    return _package_results(x, V, M, w, RA, RB)


# ==========================================================
# CANTILEVER BEAM (FIXED AT LEFT)
# ==========================================================
def solve_cantilever(L, loads, E=210e9, I=8e-6):

    RA = 0.0
    MA = 0.0

    for load in loads:
        if load["type"] == "point":
            RA += load["P"]
            MA += load["P"] * load["x"]

        elif load["type"] == "udl":
            w, x1, x2 = load["w"], load["x1"], load["x2"]
            W = w * (x2 - x1)
            xc = 0.5 * (x1 + x2)
            RA += W
            MA += W * xc

        elif load["type"] == "moment":
            MA += load["M"]

    x, V, M, w = _beam_response(
        L, loads, RA, MA, E, I, fixed_left=True
    )

    return _package_results(x, V, M, w, RA, 0.0, MA=MA)


# ==========================================================
# FIXED–FIXED BEAM (NUMERICAL – STABLE)
# ==========================================================
def solve_fixed_fixed(L, loads, E=210e9, I=8e-6):

    total_force = 0.0
    total_moment = 0.0

    for load in loads:
        if load["type"] == "point":
            total_force += load["P"]
            total_moment += load["P"] * load["x"]

        elif load["type"] == "udl":
            w, x1, x2 = load["w"], load["x1"], load["x2"]
            W = w * (x2 - x1)
            xc = 0.5 * (x1 + x2)
            total_force += W
            total_moment += W * xc

        elif load["type"] == "moment":
            total_moment += load["M"]

    # symmetric initial estimate
    RA = total_force / 2
    RB = total_force / 2

    MA = total_moment / (2 * L)

    x, V, M, w = _beam_response(
        L, loads, RA, MA, E, I,
        fixed_left=True,
        fixed_right=True
    )

    # enforce zero deflection at right end
    w -= (x / L) * w[-1]

    return _package_results(x, V, M, w, RA, RB, MA=MA)


# ==========================================================
# OVERHANG BEAM 
# ==========================================================
def solve_overhang(L, Lo, loads, E=210e9, I=8e-6):
    """
    Pin at x=0, roller at x = a, overhang from a to L
    """
    a = L - Lo  # roller location

    # ---------------- Equilibrium ----------------
    total_force = 0.0
    total_moment_about_A = 0.0

    for load in loads:
        if load["type"] == "point":
            P, x = load["P"], load["x"]
            total_force += P
            total_moment_about_A += P * x

        elif load["type"] == "udl":
            w, x1, x2 = load["w"], load["x1"], load["x2"]
            W = w * (x2 - x1)
            xc = 0.5 * (x1 + x2)
            total_force += W
            total_moment_about_A += W * xc

        elif load["type"] == "moment":
            total_moment_about_A += load["M"]

    # Reactions
    RB = total_moment_about_A / a
    RA = total_force - RB

    # ---------------- Internal response ----------------
    x = np.linspace(0, L, 600)
    dx = x[1] - x[0]

    V = np.ones_like(x) * RA
    M = RA * x

    for load in loads:
        if load["type"] == "point":
            P, xp = load["P"], load["x"]
            V[x >= xp] -= P
            M[x >= xp] -= P * (x[x >= xp] - xp)

        elif load["type"] == "udl":
            w, x1, x2 = load["w"], load["x1"], load["x2"]
            d = np.clip(x - x1, 0, x2 - x1)
            V -= w * d
            M -= w * d**2 / 2
            idx = x >= x2
            M[idx] -= w * (x[idx] - x2) * (x2 - x1)

        elif load["type"] == "moment":
            xp, M0 = load["x"], load["M"]
            M[x >= xp] -= M0

    # ---------------- Deflection ----------------
    curvature = M / (E * I)
    theta = np.cumsum(curvature) * dx
    w = np.cumsum(theta) * dx

    # Enforce w(0)=0 and w(a)=0
    w -= (x / a) * np.interp(a, x, w)

    return {
        "reactions": {
            "RA": round(RA, 3),
            "RB": round(RB, 3)
        },
        "x": x.tolist(),
        "shear": V.tolist(),
        "moment": M.tolist(),
        "deflection": w.tolist()
    }


# ==========================================================
# DISPATCHER
# ==========================================================
def solve_beam(
    beam_type,
    L,
    loads,
    E=210e9,
    I=8e-6,
    overhang_length=None   
):
    if beam_type == "simply_supported":
        return solve_simply_supported(L, loads, E, I)

    if beam_type == "cantilever":
        return solve_cantilever(L, loads, E, I)

    if beam_type == "fixed_fixed":
        return solve_fixed_fixed(L, loads, E, I)

    if beam_type == "overhang":
        if overhang_length is None:
            raise ValueError("Overhang length required for overhang beam")
        return solve_overhang(L, overhang_length, loads, E, I)

    raise ValueError(f"Unknown beam type: {beam_type}")


# ==========================================================
# RESULT PACKAGING
# ==========================================================
def _package_results(x, V, M, w, RA, RB, MA=0.0):
    return {
        "reactions": {
            "RA": round(RA, 3),
            "RB": round(RB, 3),
            "MA": round(MA, 3)
        },
        "x": x.tolist(),
        "shear": V.tolist(),
        "moment": M.tolist(),
        "deflection": w.tolist()
    }
