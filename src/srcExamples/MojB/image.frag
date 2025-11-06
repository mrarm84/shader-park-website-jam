void doRay(vec3 o, vec3 u, out vec4 hit, out vec3 normal, bool fromOutside);
void raySphere(vec3 o, vec3 u, vec3 c, float r, out vec4 hit1, out vec4 hit2);
float wave(float x);
vec3 wave3(vec3 x);
void swapIf(inout float a, inout float b);
float inverseLerp(float a, float b, float x);
vec3 inverseLerp3(vec3 a, vec3 b, vec3 x);
float reflectionCoefficient(float cosineTheta1);
vec3 bubbleReflectionColor(vec3 hit, vec3 incident, vec3 normal);
float g(float x, float u, float t1, float t2);
float cmfX(float w);
float cmfY(float w);
float cmfZ(float w);
vec3 xyz(float w);
vec3 rgbToSrgb(vec3 rgb);
vec3 srgbToRgb(vec3 srgb);
vec3 brightenHighlights(vec3 rgb);

const float PI = 4.0 * atan(1.0);
const float FOV = 75.0;
const float TAN_FOV = tan(radians(0.5 * FOV));
const int NUM_BALLS = 8;
const vec3 BOX_WIDTH = vec3(3.0, 1.0, 1.5);
const vec3 BOX_START = vec3(-BOX_WIDTH.x / 2.0, -BOX_WIDTH.y / 2.0, 3.0);
const vec3 BOX_END = BOX_START + BOX_WIDTH;
const float METABALL_STEP = 0.002;
const float METABALL_THRESHOLD = 0.2;
const float BUBBLE_REFRACTIVE_INDEX = 1.33;
const float BUBBLE_R0 = pow(abs((1.0 - BUBBLE_REFRACTIVE_INDEX) / (1.0 + BUBBLE_REFRACTIVE_INDEX)), 2.0);
const float BUBBLE_N1N2_SQUARED = 1.0 / pow(BUBBLE_REFRACTIVE_INDEX, 2.0);
const float BUBBLE_THICKNESS_TOP = 100.0;
const float BUBBLE_THICKNESS_BOTTOM = 850.0;
const float METABALL_SPEED = 0.5;

struct Metaball {
    vec3 pos;
    vec3 vel;
};
const Metaball METABALLS[NUM_BALLS] = Metaball[](
    Metaball(vec3(1.72, 0.35, 1.08), vec3(0.54, -0.62, 0.97)),
    Metaball(vec3(0.41, 1.26, 0.89), vec3(-0.38, 0.15, -0.92)),
    Metaball(vec3(0.12, 0.77, 1.53), vec3(0.23, 0.81, -0.07)),
    Metaball(vec3(1.95, 0.09, 1.24), vec3(-0.73, -0.11, 0.45)),
    Metaball(vec3(0.67, 1.84, 0.56), vec3(0.69, -0.84, 0.18)),
    Metaball(vec3(1.38, 0.48, 0.23), vec3(-0.25, 0.66, -0.55)),
    Metaball(vec3(0.95, 0.17, 1.69), vec3(0.02, -0.97, 0.34)),
    Metaball(vec3(1.57, 1.42, 0.74), vec3(-0.88, 0.42, -0.19))
);
vec3 metaballPos(Metaball ball);
float metaballValueSum(vec3 at);
vec3 metaballGradientSum(vec3 at);

vec3 skybox(vec3 u) {
    return srgbToRgb(texture(iChannel0, u).rgb);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = 2.0 * (fragCoord / iResolution.xy - vec2(0.5));
    float aspect = iResolution.y / iResolution.x;

    vec3 ray = normalize(vec3(uv.x * TAN_FOV, uv.y * TAN_FOV * aspect, 1.0));
    vec4 hit;
    vec3 normal;
    fragColor = vec4(vec3(0.0), 1.0);
    doRay(vec3(0.0), ray, hit, normal, true);
    if (hit.w != 1.0e38) {
        float cosineTheta1 = dot(-ray, normal);
        float ref = reflectionCoefficient(cosineTheta1);
        vec3 reflected = reflect(ray, normal);
        fragColor.rgb += ref * bubbleReflectionColor(hit.xyz, ray, normal) * brightenHighlights(skybox(reflected));
        doRay(hit.xyz, ray, hit, normal, false);
        if (hit.w != 1.0e38) {
            cosineTheta1 = dot(ray, normal);
            ref = reflectionCoefficient(cosineTheta1);
            reflected = reflect(ray, normal);
            fragColor.rgb += ref * bubbleReflectionColor(hit.xyz, ray, normal) * brightenHighlights(skybox(reflected));
        }
    }
    fragColor = vec4(rgbToSrgb(fragColor.rgb), 1.0);
}

const float VISIBLE_START = 380.0;
const float VISIBLE_END = 750.0;
const float VISIBLE_STEP = 10.0;
const int VISIBLE_STEP_COUNT = int((VISIBLE_END - VISIBLE_START) / VISIBLE_STEP);
const float VISIBLE_AVERAGE_SCALE = 1.0 / float(VISIBLE_STEP_COUNT);
const mat3 xyzToRgb = transpose(mat3(
    2.364, -0.8965, -0.4681,
    -0.5152, 1.426, 0.08876,
    0.005204, -0.01441, 1.009
));

vec3 bubbleReflectionColor(vec3 hit, vec3 incident, vec3 normal) {
    float cosTheta1 = dot(-incident, normal);
    vec3 crs = cross(incident, normal);
    float sin2Theta1 = dot(crs, crs);
    float cosTheta2 = sqrt(1.0 - BUBBLE_N1N2_SQUARED * sin2Theta1);

    float thicknessT = 0.5 * (1.0 + dot(normal, vec3(0.0, -1.0, 0.0)));
    thicknessT += 0.05 * sin(5.0 * hit.x + iTime * 2.0);
    thicknessT += 0.05 * sin(5.0 * hit.y + iTime * 2.0 + 1.0);
    thicknessT += 0.05 * sin(5.0 * hit.z + iTime * 2.0 + 2.0);
    thicknessT = clamp(thicknessT, 0.0, 1.0);
    float thickness = BUBBLE_THICKNESS_TOP + (BUBBLE_THICKNESS_BOTTOM - BUBBLE_THICKNESS_TOP) * thicknessT;
    // Stolen from https://en.wikipedia.org/wiki/Thin-film_interference
    float k = 2.0 * PI * BUBBLE_REFRACTIVE_INDEX * thickness * cosTheta2;
    vec3 thinFilmColorXyz = vec3(0.0);
    float wavelength = float(VISIBLE_START);
    for (int w = 0; w <= VISIBLE_STEP_COUNT; w++) {
        float amplitude = cos(k / wavelength);
        float intensity = amplitude * amplitude;
        thinFilmColorXyz += intensity * xyz(wavelength);
        wavelength += VISIBLE_STEP;
    }
    thinFilmColorXyz *= 2.0 * VISIBLE_AVERAGE_SCALE;

    return xyzToRgb * thinFilmColorXyz;
}

// Stolen from https://en.wikipedia.org/wiki/Schlick%27s_approximation
float reflectionCoefficient(float cosineTheta1) {
    float c = 1.0 - abs(cosineTheta1);
    float c2 = c * c;
    c *= c2 * c2;
    return BUBBLE_R0 + (1.0 - BUBBLE_R0) * c;
}

void getNextRayRange(vec3 o, vec3 u, out vec4 start, out vec4 end) {
    vec4 closestEnter = vec4(1.0e38);
    vec4 farthestExit = vec4(1.0e38);
    for (int i = 0; i < NUM_BALLS; i++) {
        vec3 ballPos = metaballPos(METABALLS[i]);
        vec4 hit1, hit2;
        raySphere(o, u, ballPos, 1.0, hit1, hit2);

        if (hit1.w != 1.0e38) {
            if (hit2.w == 1.0e38) {
                if (!(hit1.w > closestEnter.w && hit1.w < farthestExit.w)) {
                    farthestExit = hit1;
                }
                closestEnter = vec4(o, 0.0);
            } else if (hit1.w < farthestExit.w && hit2.w > closestEnter.w) {
                if (hit1.w < closestEnter.w)
                    closestEnter = hit1;
                if (hit2.w > farthestExit.w)
                    farthestExit = hit2;
            } else if (hit1.w < closestEnter.w) {
                closestEnter = hit1;
                farthestExit = hit2;
            }
        }
    }
    start = closestEnter;
    end = farthestExit;
}

void doRay(vec3 o, vec3 u, out vec4 hit, out vec3 normal, bool fromOutside) {
    float side = fromOutside ? 1.0 : -1.0;
    float t = 0.0;
    while (true) {
        vec3 oNew = o + t * u;
        vec4 start;
        vec4 end;
        getNextRayRange(oNew, u, start, end);
        if (start.w == 1.0e38) {
            hit = vec4(1.0e38);
            normal = vec3(1.0e38);
            return;
        }

        int steps = int(abs(end.w - start.w) / METABALL_STEP);
        float tt = start.w;
        vec3 sampled = oNew + tt * u;
        vec3 stepSampled = METABALL_STEP * u;
        for (int i = 0; i < steps; i++) {
            if (metaballValueSum(sampled) * side >= METABALL_THRESHOLD * side) {
                hit = vec4(sampled, tt);
                normal = normalize(metaballGradientSum(sampled));
                return;
            }
            tt += METABALL_STEP;
            sampled += stepSampled;
        }

        t += end.w + METABALL_STEP;
    }
}

void raySphere(vec3 o, vec3 u, vec3 c, float r, out vec4 hit1, out vec4 hit2) {
    vec3 oc = o - c;
    float uoc = dot(u, oc);
    float nabla = uoc * uoc - dot(oc, oc) + r * r;
    if (nabla < 0.0) {
        hit1 = hit2 = vec4(1.0e38);
    } else {
        float sqrtNabla = sqrt(nabla);
        float t1 = -uoc - sqrtNabla;
        float t2 = -uoc + sqrtNabla;
        swapIf(t1, t2);
        if (t1 < 0.0) {
            t1 = t2;
            t2 = 1.0e38;
            if (t1 < 0.0) {
                t1 = 1.0e38;
            }
        }
        hit1 = vec4(o + t1 * u, t1);
        hit2 = vec4(o + t2 * u, t2);
    }
}

float metaballValue(vec3 pos, vec3 at) {
    vec3 d = pos - at;
    float r2 = min(dot(d, d), 1.0);
    float ret = 1.0 - r2;
    ret *= ret;
    ret *= ret;
    return ret;
}

vec3 metaballGradient(vec3 pos, vec3 at) {
    vec3 d = pos - at;
    float r2 = min(dot(d, d), 1.0);
    float x = 1.0 - r2;
    x *= x * x;
    return -d * x;
}

float metaballValueSum(vec3 at) {
    float ret = 0.0;
    for (int i = 0; i < NUM_BALLS; i++) {
        ret += metaballValue(metaballPos(METABALLS[i]), at);
    }
    return ret;
}

vec3 metaballGradientSum(vec3 at) {
    vec3 ret = vec3(0.0);
    for (int i = 0; i < NUM_BALLS; i++) {
        ret += metaballGradient(metaballPos(METABALLS[i]), at);
    }
    return ret;
}

vec3 metaballPos(Metaball ball) {
    return BOX_START + BOX_WIDTH * wave3(inverseLerp3(BOX_START, BOX_END, ball.pos) + iTime * ball.vel * METABALL_SPEED / BOX_WIDTH);
}

float wave(float x) {
    return smoothstep(0.0, 1.0, abs(mod(x - 1.0, 2.0) - 1.0));
}

vec3 wave3(vec3 x) {
    return vec3(
        wave(x.x),
        wave(x.y),
        wave(x.z)
    );
}

void swapIf(inout float a, inout float b) {
    float minab = min(a, b);
    float maxab = max(a, b);
    a = minab;
    b = maxab;
}

float inverseLerp(float a, float b, float x) {
    return (x - a) / (b - a);
}

vec3 inverseLerp3(vec3 a, vec3 b, vec3 x) {
    return vec3(
        inverseLerp(a.x, b.x, x.x),
        inverseLerp(a.y, b.y, x.y),
        inverseLerp(a.z, b.z, x.z)
    );
}

// Stolen from https://en.wikipedia.org/wiki/CIE_1931_color_space
float g(float x, float u, float t1, float t2) {
    float xu2 = x - u;
    xu2 *= xu2;
    if (x < u)
        return exp(-t1 * t1 * xu2 * 0.5);
    else
        return exp(-t2 * t2 * xu2 * 0.5);
}

float cmfX(float w) {
    return 1.056 * g(w, 599.8, 0.0264, 0.0323) + 0.362 * g(w, 442.0, 0.0624, 0.0374) - 0.065 * g(w, 501.1, 0.0490, 0.0382);
}

float cmfY(float w) {
    return 0.821 * g(w, 568.8, 0.0213, 0.0247) + 0.286 * g(w, 530.9, 0.0613, 0.0322);
}

float cmfZ(float w) {
    return 1.217 * g(w, 437.0, 0.0845, 0.0278) + 0.681 * g(w, 459.0, 0.0385, 0.0725);
}

vec3 xyz(float w) {
    return vec3(cmfX(w), cmfY(w), cmfZ(w));
}

// Stolen from https://en.wikipedia.org/wiki/SRGB
float gammaCorrect(float comp) {
    return comp <= 0.0031308 ? 12.92 * comp : 1.055 * pow(comp, 1.0 / 2.4) - 0.055;
}

vec3 rgbToSrgb(vec3 rgb) {
    rgb = clamp(rgb, vec3(0.0), vec3(1.0));
    return vec3(gammaCorrect(rgb.r), gammaCorrect(rgb.g), gammaCorrect(rgb.b));
}

float gammaUncorrect(float scomp) {
    return scomp <= 0.04045 ? scomp / 12.92 : pow((scomp + 0.055) / 1.055, 2.4);
}

vec3 srgbToRgb(vec3 srgb) {
    srgb = clamp(srgb, vec3(0.0), vec3(1.0));
    return vec3(gammaUncorrect(srgb.r), gammaUncorrect(srgb.g), gammaUncorrect(srgb.b));
}

float brightenHighlightsComp(float comp) {
    float c16 = comp;
    c16 *= c16;
    c16 *= c16;
    c16 *= c16;
    c16 *= c16;

    return 4.0 * c16 + comp;
}

vec3 brightenHighlights(vec3 rgb) {
    return vec3(brightenHighlightsComp(rgb.r), brightenHighlightsComp(rgb.g), brightenHighlightsComp(rgb.b));
}
