import {join} from "path";
import {AppUpdater, autoUpdater} from "electron-updater";
import Log from "@/lib/log";
import {delDir} from "@/lib/file";
import {ipcMain} from "electron";
import {Window} from "@/main/modular/window";

const config = require("@/cfg/config.json");

/**
 * 更新模块
 * */
export class Update {
    public autoUpdater: AppUpdater = autoUpdater;

    /**
     * 渲染进程data key
     */
    public key: string = "update-message";

    constructor() {
    }

    /**
     * 删除更新包文件
     */
    handleUpdate() {
        // @ts-ignore
        const updatePendingPath = join(this.autoUpdater.app.baseCachePath, config.updaterCacheDirName, 'pending');
        delDir(updatePendingPath);
    }

    /**
     * 检查更新
     * @param messageBack 反馈更新状态
     */
    open(messageBack: Function) {
        this.handleUpdate();
        let message = {
            error: {key: this.key, value: {code: 0, msg: "检查更新出错"}},
            checking: {key: this.key, value: {code: 1, msg: "正在检查更新"}},
            updateAva: {key: this.key, value: {code: 2, msg: "检测到新版本,正在下载"}},
            updateDown: {key: this.key, value: {code: 3, value: "", msg: "下载中"}},
            updateDownload: {key: this.key, value: {code: 4, msg: "已下载完毕"}},
            updateNotAva: {key: this.key, value: {code: 5, msg: "现在使用的就是最新版本,不用更新"}}
        };
        //本地开发环境，改变app-update.yml地址
        if (process.env.NODE_ENV === 'development' && !(process.platform === 'darwin')) {
            this.autoUpdater.updateConfigPath = join('out/win-unpacked/resources/app-update.yml')
        }
        // 这里的URL就是更新服务器的放置文件的地址
        this.autoUpdater.setFeedURL({
            provider: 'generic',
            url: config.updateFileUrl
        });
        this.autoUpdater.on("error", () => messageBack(message.error));
        this.autoUpdater.on("checking-for-update", () => messageBack(message.checking));
        this.autoUpdater.on("update-available", () => messageBack(message.updateAva));
        this.autoUpdater.on("update-not-available", () => messageBack(message.updateNotAva));
        // 更新下载进度事件
        this.autoUpdater.on("download-progress", (progressObj) => {
            message.updateDown.value["value"] = progressObj;
            messageBack(message.updateDown);
        });
        // 下载完成事件
        this.autoUpdater.on("update-downloaded", () => messageBack(message.updateDownload));
        this.autoUpdater.checkForUpdates().catch(e => Log.error("[checkForUpdates]", e));
    }

    /**
     * 重新检查
     * @param isDel 是否删除历史更新缓存
     */
    checkUpdate(isDel: boolean) {
        if (isDel) this.handleUpdate();
        this.autoUpdater.checkForUpdates().catch(e => Log.error("[checkUpdate|checkForUpdates]", e));
    }

    /**
     * 关闭程序进行更新
     * @param isSilent 是否静默更新
     */
    updateQuitInstall(isSilent: boolean = false) {
        this.autoUpdater.quitAndInstall(isSilent);
    }

    /**
     * 开启监听
     */
    on(window: Window) {
        //开启更新监听
        ipcMain.on("update-check", () => {
            this.open((data: { key: string; value: any }) => { //更新消息
                for (let i in window.group) {
                    if (window.group[i]) {
                        window.getWindow(Number(i)).webContents.send("message-back", data);
                    }
                }
            })
        });
        //重新检查更新 isDel 是否删除历史更新缓存
        ipcMain.on("update-recheck", (event, isDel) => this.checkUpdate(isDel));
        // 关闭程序安装新的软件 isSilent 是否静默更新
        ipcMain.on("update-quit-install", (event, isSilent) => this.updateQuitInstall(isSilent));
    }

}
