import Cocoa
import WebKit

/// A tiny native shell: one small window hosting the HTML5 game, with saves written to Application Support.
final class SaveBridge: NSObject, WKScriptMessageHandler {
    let url: URL
    init(url: URL) { self.url = url }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let json = message.body as? String else { return }
        try? json.write(to: url, atomically: true, encoding: .utf8)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var bridge: SaveBridge!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("EncoreMatch", isDirectory: true)
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        let saveURL = support.appendingPathComponent("save.json")
        bridge = SaveBridge(url: saveURL)

        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(bridge, name: "save")
        if let data = try? Data(contentsOf: saveURL),
           (try? JSONSerialization.jsonObject(with: data)) != nil,
           let json = String(data: data, encoding: .utf8) {
            let script = WKUserScript(source: "window.__ENCORE_SAVE = \(json);", injectionTime: .atDocumentStart, forMainFrameOnly: true)
            config.userContentController.addUserScript(script)
        }

        let rect = NSRect(x: 0, y: 0, width: 470, height: 840)
        window = NSWindow(contentRect: rect, styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
        window.title = "Encore!"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(red: 0.04, green: 0.02, blue: 0.09, alpha: 1)
        window.minSize = NSSize(width: 380, height: 640)

        let web = WKWebView(frame: rect, configuration: config)
        web.setValue(false, forKey: "drawsBackground")
        let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "game")!
        web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())

        // keep the web content clear of the transparent title bar
        let container = NSView(frame: rect)
        web.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: container.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: container.trailingAnchor),
        ])
        window.contentView = container
        window.center()
        window.setFrameAutosaveName("EncoreMainWindow")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)

let mainMenu = NSMenu()
let appItem = NSMenuItem()
mainMenu.addItem(appItem)
let appMenu = NSMenu()
appMenu.addItem(withTitle: "Hide Encore!", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
appMenu.addItem(.separator())
appMenu.addItem(withTitle: "Quit Encore!", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
appItem.submenu = appMenu
let windowItem = NSMenuItem()
mainMenu.addItem(windowItem)
let windowMenu = NSMenu(title: "Window")
windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
windowItem.submenu = windowMenu
app.mainMenu = mainMenu

app.run()
