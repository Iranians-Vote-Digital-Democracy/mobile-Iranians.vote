import ExpoModulesCore
import SwoirenbergLib

public class NoirModule: Module {
  private var circuit: Circuit?

  public func definition() -> ModuleDefinition {
    Name("Noir")

    /**
     * Generates a PLONK proof using the Noir circuit.
     * @param trustedSetupUri URI pointing to the SRS file (e.g. file://...)
     * @param inputsJson JSON string representing a map of witness values
     * @param manifestJson JSON manifest for the circuit bytecode
     * @return a hex string representing the generated proof
     * @throws Throwable if proof generation fails
     */
    AsyncFunction("provePlonk") { (trustedSetupUri: String, inputsJson: String, manifestJson: String) in
      guard let srsPath = URL(string: trustedSetupUri)?.path else {
        throw NSError(domain: "NoirModule", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid URI: \(trustedSetupUri)"])
      }

      if self.circuit == nil {
        guard let manifestData = manifestJson.data(using: .utf8) else {
          throw NSError(domain: "NoirModule", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid manifest JSON string"])
        }

        self.circuit = try Swoir(backend: Swoirenberg.self).createCircuit(manifest: manifestData)
        try self.circuit?.setupSrs(srs_path: srsPath)
      }

      guard let inputsData = inputsJson.data(using: .utf8),
            let inputsMap = try JSONSerialization.jsonObject(with: inputsData, options: []) as? [String: Any] else {
        throw NSError(domain: "NoirModule", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to parse inputs JSON"])
      }

      let proof = try self.circuit!.prove(inputsMap, proof_type: "plonk")
      let hexProof = proof.proof.map { String(format: "%02x", $0) }.joined()

      return hexProof
    }
  }
}
