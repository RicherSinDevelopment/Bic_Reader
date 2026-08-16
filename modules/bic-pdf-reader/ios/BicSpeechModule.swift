import AVFoundation
import ExpoModulesCore

private let speechStartedEvent = "speechStarted"
private let speechBoundaryEvent = "speechBoundary"
private let speechFinishedEvent = "speechFinished"
private let speechStoppedEvent = "speechStopped"
private let voicesChangedEvent = "voicesChanged"

public final class BicSpeechModule: Module {
  private let speechController = SpeechController()
  private var voicesObserver: NSObjectProtocol?

  private var synthesizer: AVSpeechSynthesizer {
    speechController.synthesizer
  }

  public func definition() -> ModuleDefinition {
    Name("BicSpeech")

    Events([
      speechStartedEvent,
      speechBoundaryEvent,
      speechFinishedEvent,
      speechStoppedEvent,
      voicesChangedEvent,
    ])

    OnCreate {
      speechController.onStarted = { [weak self] in
        self?.sendEvent(speechStartedEvent)
      }
      speechController.onBoundary = { [weak self] range in
        self?.sendEvent(speechBoundaryEvent, [
          "charIndex": range.location,
          "charLength": range.length,
        ])
      }
      speechController.onFinished = { [weak self] in
        self?.sendEvent(speechFinishedEvent)
        self?.deactivateAudioSession()
      }
      speechController.onStopped = { [weak self] in
        self?.sendEvent(speechStoppedEvent)
        self?.deactivateAudioSession()
      }
      if #available(iOS 17.0, *) {
        voicesObserver = NotificationCenter.default.addObserver(
          forName: AVSpeechSynthesizer.availableVoicesDidChangeNotification,
          object: nil,
          queue: .main
        ) { [weak self] _ in
          self?.sendEvent(voicesChangedEvent)
        }
      }
    }

    OnDestroy {
      synthesizer.stopSpeaking(at: .immediate)
      if let voicesObserver {
        NotificationCenter.default.removeObserver(voicesObserver)
      }
    }

    AsyncFunction("getVoices") { () -> [AppleSpeechVoiceRecord] in
      AVSpeechSynthesisVoice.speechVoices().map { voice in
        var record = AppleSpeechVoiceRecord()
        record.identifier = voice.identifier
        record.name = voice.name
        record.language = voice.language
        record.quality = qualityName(voice.quality)
        record.gender = genderName(voice.gender)
        return record
      }
    }.runOnQueue(.main)

    AsyncFunction("speak") {
      (text: String, voiceIdentifier: String?, rate: Double) throws in
      guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw SpeechException("There is no text to speak.")
      }

      if synthesizer.isSpeaking || synthesizer.isPaused {
        synthesizer.stopSpeaking(at: .immediate)
      }

      var voice: AVSpeechSynthesisVoice?
      if let voiceIdentifier {
        guard let installedVoice = AVSpeechSynthesisVoice(identifier: voiceIdentifier) else {
          throw SpeechException("The selected Apple voice is no longer installed.")
        }
        voice = installedVoice
      }
      let speechRate = max(
        AVSpeechUtteranceMinimumSpeechRate,
        min(AVSpeechUtteranceMaximumSpeechRate, Float(rate) * AVSpeechUtteranceDefaultSpeechRate)
      )
      speechController.speak(text: text, voice: voice, rate: speechRate)
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      speechController.stop()
    }.runOnQueue(.main)

    AsyncFunction("pause") {
      synthesizer.pauseSpeaking(at: .word)
    }.runOnQueue(.main)

    AsyncFunction("resume") {
      synthesizer.continueSpeaking()
    }.runOnQueue(.main)

    AsyncFunction("isSpeaking") {
      synthesizer.isSpeaking || synthesizer.isPaused
    }.runOnQueue(.main)
  }

  private func deactivateAudioSession() {
    // AVSpeechSynthesizer manages its own audio session. Keeping this callback
    // makes the finish/cancel paths symmetrical without interfering with audio.
  }
}

private final class SpeechController: NSObject, AVSpeechSynthesizerDelegate, @unchecked Sendable {
  let synthesizer = AVSpeechSynthesizer()
  var onStarted: (() -> Void)?
  var onBoundary: ((NSRange) -> Void)?
  var onFinished: (() -> Void)?
  var onStopped: (() -> Void)?
  private var pendingUtterances = 0
  private var stopReported = false

  override init() {
    super.init()
    synthesizer.delegate = self
    synthesizer.usesApplicationAudioSession = false
  }

  func speak(text: String, voice: AVSpeechSynthesisVoice?, rate: Float) {
    stop()
    let chunks = speechChunks(text)
    pendingUtterances = chunks.count
    stopReported = false
    for chunk in chunks {
      let utterance = BicSpeechUtterance(
        text: chunk.text,
        sourceOffset: chunk.offset
      )
      utterance.voice = voice
      utterance.rate = rate
      utterance.pitchMultiplier = 1
      utterance.volume = 1
      synthesizer.speak(utterance)
    }
  }

  func stop() {
    guard synthesizer.isSpeaking || synthesizer.isPaused else { return }
    synthesizer.stopSpeaking(at: .immediate)
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didStart utterance: AVSpeechUtterance
  ) {
    onStarted?()
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    willSpeakRangeOfSpeechString characterRange: NSRange,
    utterance: AVSpeechUtterance
  ) {
    let sourceOffset = (utterance as? BicSpeechUtterance)?.sourceOffset ?? 0
    onBoundary?(NSRange(
      location: sourceOffset + characterRange.location,
      length: characterRange.length
    ))
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didFinish utterance: AVSpeechUtterance
  ) {
    pendingUtterances = max(0, pendingUtterances - 1)
    if pendingUtterances == 0 {
      onFinished?()
    }
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didCancel utterance: AVSpeechUtterance
  ) {
    pendingUtterances = 0
    if !stopReported {
      stopReported = true
      onStopped?()
    }
  }
}

private final class BicSpeechUtterance: AVSpeechUtterance {
  let sourceOffset: Int

  init(text: String, sourceOffset: Int) {
    self.sourceOffset = sourceOffset
    super.init(string: text)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("Not implemented")
  }
}

private func speechChunks(_ text: String, maximumLength: Int = 3_000) -> [(text: String, offset: Int)] {
  let source = text as NSString
  var chunks: [(text: String, offset: Int)] = []
  var start = 0
  while start < source.length {
    var end = min(source.length, start + maximumLength)
    if end < source.length {
      let searchRange = NSRange(location: start, length: end - start)
      let whitespace = source.rangeOfCharacter(
        from: .whitespacesAndNewlines,
        options: .backwards,
        range: searchRange
      )
      if whitespace.location != NSNotFound && whitespace.location > start {
        end = whitespace.location + whitespace.length
      }
    }
    let range = NSRange(location: start, length: end - start)
    chunks.append((source.substring(with: range), start))
    start = end
  }
  return chunks
}

private struct AppleSpeechVoiceRecord: Record {
  @Field var identifier = ""
  @Field var name = ""
  @Field var language = ""
  @Field var quality = "Default"
  @Field var gender = "Unspecified"
}

private func qualityName(_ quality: AVSpeechSynthesisVoiceQuality) -> String {
  switch quality {
  case .premium:
    return "Premium"
  case .enhanced:
    return "Enhanced"
  default:
    return "Default"
  }
}

private func genderName(_ gender: AVSpeechSynthesisVoiceGender) -> String {
  switch gender {
  case .male:
    return "Male"
  case .female:
    return "Female"
  default:
    return "Unspecified"
  }
}

private final class SpeechException: GenericException<String>, @unchecked Sendable {
  override var reason: String { param }
}
