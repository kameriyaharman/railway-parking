package expo.modules.btprinter

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

/**
 * Prints raw ESC/POS bytes to a paired classic-Bluetooth thermal printer over SPP (RFCOMM).
 * The socket is kept open between prints so consecutive tokens print instantly.
 */
@SuppressLint("MissingPermission")
class BtPrinterModule : Module() {
  private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
  private var socket: BluetoothSocket? = null
  private var connectedAddress: String? = null
  private val lock = Any()

  private fun adapter(): BluetoothAdapter? {
    val ctx = appContext.reactContext ?: return null
    val manager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    return manager?.adapter
  }

  private fun closeSocket() {
    try { socket?.close() } catch (_: Exception) {}
    socket = null
    connectedAddress = null
  }

  override fun definition() = ModuleDefinition {
    Name("BtPrinter")

    AsyncFunction("isEnabled") {
      adapter()?.isEnabled == true
    }

    AsyncFunction("getPairedDevices") {
      val a = adapter() ?: throw CodedException("ERR_NO_BLUETOOTH", "Is phone me Bluetooth nahi hai", null)
      if (!a.isEnabled) throw CodedException("ERR_BLUETOOTH_OFF", "Bluetooth ON karein", null)
      a.bondedDevices.map { mapOf("name" to (it.name ?: it.address), "address" to it.address) }
    }

    AsyncFunction("print") { address: String, base64: String ->
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      synchronized(lock) {
        var s = socket
        if (s == null || !s.isConnected || connectedAddress != address) {
          closeSocket()
          val a = adapter() ?: throw CodedException("ERR_NO_BLUETOOTH", "Is phone me Bluetooth nahi hai", null)
          if (!a.isEnabled) throw CodedException("ERR_BLUETOOTH_OFF", "Bluetooth ON karein", null)
          a.cancelDiscovery()
          val device = a.getRemoteDevice(address)
          val fresh = device.createRfcommSocketToServiceRecord(sppUuid)
          try {
            fresh.connect()
          } catch (e: Exception) {
            try { fresh.close() } catch (_: Exception) {}
            throw CodedException("ERR_CONNECT", "Printer se connect nahi hua — printer ON hai? (${e.message})", e)
          }
          socket = fresh
          connectedAddress = address
          s = fresh
        }
        try {
          val out = s!!.outputStream
          out.write(bytes)
          out.flush()
        } catch (e: Exception) {
          closeSocket()
          throw CodedException("ERR_WRITE", "Print nahi hua, dobara try karein (${e.message})", e)
        }
      }
      true
    }

    AsyncFunction("disconnect") {
      synchronized(lock) { closeSocket() }
      true
    }

    OnDestroy {
      closeSocket()
    }
  }
}
