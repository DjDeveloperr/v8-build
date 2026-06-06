
/**
/**
 * 用途：构建脚本相关的工具函数及流程控制
 */

const fs = require("fs");
const path = require("path");

const trace = function (...args) {
    console.log("builder: ", ...args);
}


/**
 * 解析args.gn文件，返回一个对象
 * @param {*} argsPath args.gn文件路径
 * @returns 对象
 */
let parseGNArgs = function (argsPath, isToArray = false) {
    const content = fs.readFileSync(argsPath, "utf8");
    const lines = content.split("\n");
    let result = isToArray ? [] : {};
    const args = {};
    for (let line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
            continue;
        }
        if (trimmedLine.includes("=")) {
            const [key, value] = trimmedLine.split("=");
            args[key] = value.trim();
        }
    }
    return args;
}
const v8Version = process.env.V8_VERSION;
const v8Major = process.env.V8_MAJOR;
const platform = process.env.PLATFORM; // arm64|arm|x64
const jobName = process.env.JOB_NAME;  // android|ios|mac|win
const workspace = process.env.WORKSPACE;
const NDK_ROOT = process.env.NDK_ROOT;

trace("v8Version=" + v8Version);
trace("v8Major=" + v8Major);
trace("platform=" + platform);
trace("jobName=" + jobName);
trace("NDK_ROOT=" + NDK_ROOT);
trace("workspace=" + workspace);

const v8SourcePath = path.join(workspace, "v8");

const getArgsPath = function () {
    const buildType = process.env.BUILD_TYPE;
    if (jobName === "win" && buildType) {
        return path.join(workspace, `args.${jobName}.${platform}.${buildType}.gn`);
    }
    return path.join(workspace, `args.${jobName}.${platform}.gn`);
};

const unsupportedGNArgsByMajor = {
    "10": new Set([
        "enable_rust",
        "use_ml_inliner",
        "v8_enable_builtins_optimization",
        "v8_enable_drumbrake",
        "v8_enable_fuzztest",
        "v8_enable_temporal_support",
    ]),
    "11": new Set([
        "enable_rust",
        "use_ml_inliner",
        "v8_enable_drumbrake",
        "v8_enable_fuzztest",
        "v8_enable_temporal_support",
    ]),
};

const sanitizeGNArgs = function (argsPath) {
    if (!fs.existsSync(argsPath)) {
        trace("args file does not exist, skip sanitize: " + argsPath);
        return;
    }

    const unsupported = unsupportedGNArgsByMajor[v8Major] || new Set();
    let changed = false;
    let removed = [];
    let content = fs.readFileSync(argsPath, "utf8");
    let lines = content.split("\n").filter((line) => {
        const match = line.trim().match(/^([A-Za-z0-9_]+)\s*=/);
        if (!match || !unsupported.has(match[1])) {
            return true;
        }
        changed = true;
        removed.push(match[1]);
        return false;
    });

    if (jobName === "ios" && (v8Major === "10" || v8Major === "11")) {
        lines = lines.map((line) => {
            if (line.trim() === "v8_enable_webassembly=true") {
                changed = true;
                trace("Disable iOS WebAssembly for V8 " + v8Major + " because drumbrake is unavailable");
                return "v8_enable_webassembly=false";
            }
            return line;
        });
    }

    if (changed) {
        fs.writeFileSync(argsPath, lines.join("\n"));
        if (removed.length > 0) {
            trace("Removed unsupported GN args for V8 " + v8Major + ": " + [...new Set(removed)].join(", "));
        }
    }
};

const appendGNArgIfMissing = function (argsPath, line) {
    let content = fs.readFileSync(argsPath, "utf8");
    if (content.split("\n").some((existingLine) => existingLine.trim() === line)) {
        return content;
    }
    if (!content.endsWith("\n")) {
        content += "\n";
    }
    content += line + "\n";
    fs.writeFileSync(argsPath, content);
    return content;
};

/**
 * 在ninja构建前执行，修改v8源码
 */
let onBeforeBuild = function () {
    const argsPath = getArgsPath();
    sanitizeGNArgs(argsPath);

    switch (jobName) {
        case "android": {
            /**
             * android_ndk_root="${NDK_ROOT}"
clang_base_path="${NDK_ROOT}/toolchains/llvm/prebuilt/linux-x86_64"
             * 
             */
            let newGnContent = appendGNArgIfMissing(argsPath, "use_glib=false");
            trace("**********************************************")
            trace(newGnContent);
            trace("**********************************************")
            break;
        }
        case "ios": {
            const gnContent = fs.readFileSync(argsPath, "utf8");
            if (gnContent.indexOf(`v8_enable_drumbrake=true`) >= 0) {
                {
                    trace("v8_enable_drumbrake = true");
                    //  BUILD.gn
                    let gnPath = path.join(v8SourcePath, "BUILD.gn");
                    let content = fs.readFileSync(gnPath, "utf8");
                    const lines = content.split("\n");
                    let isModify = false;
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes("is_drumbrake_supported")) {
                            if (lines[i].trim().startsWith("#")) {
                                break;
                            }
                            trace("********************************** Modify BUILD.gn:line-" + (i - 1));
                            lines[i - 1] = `# ${lines[i - 1]}`;
                            lines[i] = `# ${lines[i]}`;
                            lines[i + 1] = `# ${lines[i + 1]}`;
                            isModify = true;
                            break;
                        }
                    }
                    isModify && fs.writeFileSync(gnPath, lines.join("\n"));
                }
            }
            break;
        }

        case "mac":
            {
                // DO NOTHING
                break;
            }
        case "win":
            {
                // DO NOTHING
                break;
            }
    }
};
onBeforeBuild();
