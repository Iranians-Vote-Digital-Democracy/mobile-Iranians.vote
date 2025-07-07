package expo.modules.noir

import android.util.Log
import androidx.core.net.toUri
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.noirandroid.lib.Circuit
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

internal data class ProveInputs(
  val dg1: List<String>,
  val dg15: List<String>,
  val ec: List<String>,
  val icao_root: String,
  val inclusion_branches: List<String>,
  val pk: List<String>,
  val reduction_pk: List<String>,
  val sa: List<String>,
  val sig: List<String>,
  val sk_identity: String
)

class NoirModule : Module() {
  private val TAG = "NoirModule"
  private var circuit: Circuit? = null

  override fun definition() = ModuleDefinition {
    Name("Noir")

    /**
     * Generates a PLONK proof using the Noir circuit.
     * @param trustedSetupUri URI pointing to the SRS file (e.g. file://...)
     * @param inputsJson JSON-serialized ProveInputs
     * @param byteCodeString Ignored: manifest loaded from hardcoded file path
     * @return A hex string representing the generated proof
     */
    AsyncFunction("provePlonk") { trustedSetupUri: String, inputsJson: String, byteCodeString: String ->
      Log.i(TAG, "▶ provePlonk invoked on thread ${Thread.currentThread().name}")

      // Holder for the proof result or error
      var result: String? = null

      // Start a new thread for the heavy native call
      val worker = Thread {
        try {
          // Resolve SRS file path
          val rawPath = trustedSetupUri.toUri().path
            ?: throw IllegalArgumentException("Invalid URI: $trustedSetupUri")
          Log.d(TAG, "Resolved SRS path: $rawPath")

          // Initialize circuit & SRS if needed
          if (circuit == null) {
            Log.i(TAG, "Initializing circuit and SRS")

            // Log SRS file status
            File(rawPath).also { srsFile ->
              Log.d(TAG, "SRS exists=${srsFile.exists()}, size=${srsFile.length()}")
            }

            // Create circuit instance and setup SRS
            val c = Circuit.fromJsonManifest(byteCodeString)
            c.setupSrs(rawPath, false)
            Log.i(TAG, "SRS setup completed")
            circuit = c
          }

          // Parse the inputs JSON into structured data
          Log.i(TAG, "Parsing inputs JSON")
          val inputs: ProveInputs = Gson().fromJson(
            inputsJson,
            object : TypeToken<ProveInputs>() {}.type
          )
          Log.d(TAG, "Parsed inputs: $inputs")

          // Generate the proof using the circuit
          Log.i(TAG, "Generating proof")
          val proof = circuit!!.prove(
            mapOf(
              "dg1" to inputs.dg1,
              "dg15" to inputs.dg15,
              "ec" to inputs.ec,
              "icao_root" to inputs.icao_root,
              "inclusion_branches" to inputs.inclusion_branches,
              "pk" to inputs.pk,
              "reduction_pk" to inputs.reduction_pk,
              "sa" to inputs.sa,
              "sig" to inputs.sig,
              "sk_identity" to inputs.sk_identity
            ),
            proofType = "plonk",
            recursive = false
          )
          Log.i(TAG, "Proof generation complete")
          result = proof.proof
        } catch (t: Throwable) {
          Log.e(TAG, "Error generating proof", t)
          result = "Failed: ${t.javaClass.simpleName}"
        }
      }

      // Run and wait
      worker.start()
      worker.join()

      // Return the proof or error
      return@AsyncFunction result ?: "Failed: unknown"
    }
  }
}
