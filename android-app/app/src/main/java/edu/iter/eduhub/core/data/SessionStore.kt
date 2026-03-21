package edu.iter.eduhub.core.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import edu.iter.eduhub.core.model.AppSession
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class SessionStore(context: Context) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val sharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            "iter_eduhub_secure_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun readSession(): AppSession? {
        val raw = sharedPreferences.getString(KEY_SESSION, null) ?: return null
        return runCatching { json.decodeFromString(AppSession.serializer(), raw) }.getOrNull()
    }

    fun writeSession(session: AppSession) {
        sharedPreferences.edit().putString(KEY_SESSION, json.encodeToString(session)).apply()
    }

    fun clear() {
        sharedPreferences.edit().remove(KEY_SESSION).apply()
    }

    companion object {
        private const val KEY_SESSION = "session_json"
    }
}
