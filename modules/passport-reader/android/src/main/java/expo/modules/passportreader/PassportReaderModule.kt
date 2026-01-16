package expo.modules.passportreader

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.*
import net.sf.scuba.smartcards.CardService
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.jmrtd.BACKey
import org.jmrtd.BACKeySpec
import org.jmrtd.PassportService
import org.jmrtd.lds.CardSecurityFile
import org.jmrtd.lds.PACEInfo
import org.jmrtd.lds.SODFile
import org.jmrtd.lds.icao.DG1File
import org.jmrtd.lds.icao.DG2File
import org.jmrtd.lds.icao.DG11File
import org.jmrtd.lds.icao.DG15File
import java.security.MessageDigest
import java.security.Security

class PassportReaderModule : Module() {
    private var nfcAdapter: NfcAdapter? = null
    private var pendingPromise: Promise? = null
    private var pendingBacKey: BACKeySpec? = null
    private var pendingChallenge: String? = null
    
    companion object {
        private const val TAG = "PassportReader"
        
        init {
            Security.removeProvider(BouncyCastleProvider.PROVIDER_NAME)
            Security.insertProviderAt(BouncyCastleProvider(), 1)
        }
    }
    
    override fun definition() = ModuleDefinition {
        Name("PassportReader")
        
        AsyncFunction("initNfc") {
            val activity = appContext.currentActivity
                ?: throw PassportReaderException("No activity available")
            
            nfcAdapter = NfcAdapter.getDefaultAdapter(activity)
            nfcAdapter != null
        }
        
        AsyncFunction("isNfcEnabled") {
            val activity = appContext.currentActivity
                ?: return@AsyncFunction false
            
            val adapter = NfcAdapter.getDefaultAdapter(activity)
            adapter?.isEnabled == true
        }
        
        AsyncFunction("readPassport") Coroutine { 
            documentNumber: String,
            dateOfBirth: String,
            dateOfExpiry: String,
            challenge: String? ->
            
            withContext(Dispatchers.IO) {
                val activity = appContext.currentActivity
                    ?: throw PassportReaderException("No activity available")
                
                val adapter = NfcAdapter.getDefaultAdapter(activity)
                    ?: throw PassportReaderException("NFC not available")
                
                if (!adapter.isEnabled) {
                    throw PassportReaderException("NFC is disabled")
                }
                
                // Store BAC key for when tag is discovered
                val bacKey = BACKey(documentNumber, dateOfBirth, dateOfExpiry)
                
                // Wait for NFC tag
                val tag = waitForNfcTag(activity, adapter)
                
                // Read passport
                readPassportFromTag(tag, bacKey, challenge)
            }
        }
        
        AsyncFunction("stopNfc") {
            val activity = appContext.currentActivity ?: return@AsyncFunction
            val adapter = NfcAdapter.getDefaultAdapter(activity) ?: return@AsyncFunction
            
            try {
                adapter.disableForegroundDispatch(activity)
            } catch (e: Exception) {
                Log.w(TAG, "Error disabling foreground dispatch: ${e.message}")
            }
        }
    }
    
    private suspend fun waitForNfcTag(activity: Activity, adapter: NfcAdapter): Tag {
        return suspendCancellableCoroutine { continuation ->
            val intent = Intent(activity, activity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            val pendingIntent = PendingIntent.getActivity(
                activity, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            
            // This is simplified - in a real implementation you'd need to handle
            // the NFC tag discovery through activity callbacks
            // For now, throw an error to indicate the limitation
            continuation.cancel(PassportReaderException(
                "Direct NFC reading requires foreground dispatch setup. " +
                "Please use react-native-nfc-manager for tag discovery."
            ))
        }
    }
    
    @OptIn(ExperimentalStdlibApi::class)
    private fun readPassportFromTag(
        tag: Tag,
        bacKey: BACKeySpec,
        challenge: String?
    ): Map<String, Any> {
        val isoDep = IsoDep.get(tag)
            ?: throw PassportReaderException("Tag does not support IsoDep")
        
        isoDep.timeout = 10000 // 10 seconds
        isoDep.connect()
        
        try {
            val cardService = CardService.getInstance(isoDep)
            cardService.open()
            
            val service = PassportService(
                cardService,
                PassportService.NORMAL_MAX_TRANCEIVE_LENGTH,
                PassportService.DEFAULT_MAX_BLOCKSIZE,
                true,
                false
            )
            service.open()
            
            // Try PACE first, then fall back to BAC
            var paceSucceeded = false
            try {
                val cardSecurityFile = CardSecurityFile(
                    service.getInputStream(PassportService.EF_CARD_SECURITY)
                )
                for (securityInfo in cardSecurityFile.securityInfos) {
                    if (securityInfo is PACEInfo) {
                        service.doPACE(
                            bacKey,
                            securityInfo.objectIdentifier,
                            PACEInfo.toParameterSpec(securityInfo.parameterId),
                            null
                        )
                        paceSucceeded = true
                        break
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "PACE failed, will try BAC: ${e.message}")
            }
            
            service.sendSelectApplet(paceSucceeded)
            
            if (!paceSucceeded) {
                try {
                    service.getInputStream(PassportService.EF_COM).read()
                } catch (e: Exception) {
                    service.doBAC(bacKey)
                }
            }
            
            // Read SOD
            val sodInputStream = service.getInputStream(PassportService.EF_SOD)
            val sodBytes = sodInputStream.readBytes()
            val sodFile = SODFile(sodBytes.inputStream())
            
            // Get digest algorithm
            val digestAlgorithm = sodFile.digestAlgorithm
            val digest = if (Security.getAlgorithms("MessageDigest").contains(digestAlgorithm)) {
                MessageDigest.getInstance(digestAlgorithm)
            } else {
                MessageDigest.getInstance(digestAlgorithm, BouncyCastleProvider())
            }
            
            // Read DG1 (MRZ data)
            val dg1InputStream = service.getInputStream(PassportService.EF_DG1)
            val dg1File = DG1File(dg1InputStream)
            val mrzInfo = dg1File.mrzInfo
            
            // Read DG2 (Face image) - just get hash
            val dg2InputStream = service.getInputStream(PassportService.EF_DG2)
            val dg2File = DG2File(dg2InputStream)
            val dg2Hash = digest.digest(dg2File.encoded).toHexString()
            
            // Read DG15 (Active Authentication public key) if available
            var dg15Hex: String? = null
            try {
                val dg15InputStream = service.getInputStream(PassportService.EF_DG15)
                val dg15File = DG15File(dg15InputStream)
                dg15Hex = dg15File.encoded.toHexString()
            } catch (e: Exception) {
                Log.d(TAG, "DG15 not available: ${e.message}")
            }
            
            // Read DG11 (Additional personal details) if available
            var dg11Hex: String? = null
            try {
                val dg11InputStream = service.getInputStream(PassportService.EF_DG11)
                val dg11File = DG11File(dg11InputStream)
                dg11Hex = dg11File.encoded.toHexString()
            } catch (e: Exception) {
                Log.d(TAG, "DG11 not available: ${e.message}")
            }
            
            // Perform Active Authentication if challenge is provided
            var aaSignature: String? = null
            if (challenge != null && dg15Hex != null) {
                try {
                    val challengeBytes = challenge.hexToByteArray()
                    val response = service.doAA(
                        dg15File?.publicKey,
                        sodFile.digestAlgorithm,
                        sodFile.digestEncryptionAlgorithm,
                        challengeBytes
                    )
                    aaSignature = response.response.toHexString()
                } catch (e: Exception) {
                    Log.w(TAG, "Active Authentication failed: ${e.message}")
                }
            }
            
            // Build person details
            val personDetails = mapOf(
                "firstName" to mrzInfo.secondaryIdentifier.replace("<", " ").trim(),
                "lastName" to mrzInfo.primaryIdentifier.replace("<", " ").trim(),
                "gender" to mrzInfo.gender.toString(),
                "dateOfBirth" to mrzInfo.dateOfBirth,
                "dateOfExpiry" to mrzInfo.dateOfExpiry,
                "documentNumber" to mrzInfo.documentNumber,
                "nationality" to mrzInfo.nationality,
                "issuingAuthority" to mrzInfo.issuingState,
                "documentCode" to mrzInfo.documentCode
            )
            
            // Build data groups
            val dataGroups = mutableMapOf(
                "dg1" to dg1File.encoded.toHexString(),
                "dg2Hash" to dg2Hash,
                "sod" to sodBytes.toHexString()
            )
            
            if (dg15Hex != null) {
                dataGroups["dg15"] = dg15Hex
            }
            
            if (dg11Hex != null) {
                dataGroups["dg11"] = dg11Hex
            }
            
            // Build result
            val result = mutableMapOf<String, Any>(
                "personDetails" to personDetails,
                "dataGroups" to dataGroups
            )
            
            if (aaSignature != null) {
                result["aaSignature"] = aaSignature
            }
            
            return result
            
        } finally {
            try {
                isoDep.close()
            } catch (e: Exception) {
                Log.w(TAG, "Error closing IsoDep: ${e.message}")
            }
        }
    }
    
    private fun String.hexToByteArray(): ByteArray {
        check(length % 2 == 0) { "Hex string must have even length" }
        return chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    }
}

class PassportReaderException(message: String) : CodedException(message)
