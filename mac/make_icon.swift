import Cocoa

// Renders the app icon PNG: neon squircle with a guitar and a disco ball.
let size = 1024.0
let out = CommandLine.arguments[1]
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
let rect = NSRect(x: 80, y: 80, width: size - 160, height: size - 160)
let path = NSBezierPath(roundedRect: rect, xRadius: 190, yRadius: 190)
NSGradient(colors: [NSColor(red: 1, green: 0.31, blue: 0.85, alpha: 1), NSColor(red: 0.29, green: 0.1, blue: 0.6, alpha: 1), NSColor(red: 0.05, green: 0.02, blue: 0.15, alpha: 1)])!
    .draw(in: path, angle: -90)
NSColor(white: 1, alpha: 0.35).setStroke()
path.lineWidth = 14
path.stroke()
let draw = { (s: String, pt: CGFloat, x: CGFloat, y: CGFloat) in
    let a: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: pt)]
    let str = NSAttributedString(string: s, attributes: a)
    let sz = str.size()
    str.draw(at: NSPoint(x: x - sz.width / 2, y: y - sz.height / 2))
}
draw("🎸", 470, size / 2 - 40, size / 2 - 40)
draw("🪩", 230, size / 2 + 230, size / 2 + 240)
image.unlockFocus()
let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
