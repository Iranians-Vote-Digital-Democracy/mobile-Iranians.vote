import ExpoModulesCore
import SwoirenbergLib

public class NoirModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Noir")

    /**
     * Generates a PLONK proof using the Noir circuit.
     *
     * @param trustedSetupUri URI pointing to the SRS file (e.g. file://...)
     * @param inputsJson JSON string representing a map of witness values
     * @param manifestJson JSON manifest for the circuit bytecode
     * @return A hex string representing the generated proof
     * @throws NSError if any step of the process fails
     */
    AsyncFunction("provePlonk") { (trustedSetupUri: String, inputsJson: String, manifestJson: String) in
      // Ensure valid URI
      guard let srsPath = URL(string: trustedSetupUri)?.path else {
        throw NSError(domain: "NoirModule", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "Invalid URI: \(trustedSetupUri)"
        ])
      }

      // Ensure valid manifest JSON
      guard let manifestData = manifestJson.data(using: .utf8) else {
        throw NSError(domain: "NoirModule", code: 2, userInfo: [
          NSLocalizedDescriptionKey: "Invalid manifest JSON string"
        ])
      }

      // Create circuit and initialize SRS
      let circuit = try Swoir(backend: Swoirenberg.self).createCircuit(manifest: manifestData)
      try circuit.setupSrs(srs_path: srsPath)

      // Parse input values
      guard let inputsData = inputsJson.data(using: .utf8),
            let inputsMap = try JSONSerialization.jsonObject(with: inputsData, options: []) as? [String: Any] else {
        throw NSError(domain: "NoirModule", code: 3, userInfo: [
          NSLocalizedDescriptionKey: "Failed to parse inputs JSON"
        ])
      }

      // Generate proof
      let proof = try circuit.prove(inputsMap, proof_type: "plonk")
      let hexProof = proof.proof.map { String(format: "%02x", $0) }.joined()

      return hexProof
    }
  }
}
