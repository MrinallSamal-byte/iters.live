package edu.iter.eduhub.app

import android.app.Application
import edu.iter.eduhub.core.data.FileTransferManager
import edu.iter.eduhub.core.data.PortalRepository
import edu.iter.eduhub.core.data.SessionStore
import edu.iter.eduhub.core.network.NetworkModule

class EduHubApplication : Application() {
    lateinit var repository: PortalRepository
        private set

    override fun onCreate() {
        super.onCreate()
        repository = PortalRepository(
            context = this,
            apiService = NetworkModule.apiService,
            sessionStore = SessionStore(this),
            fileTransferManager = FileTransferManager(this)
        )
    }
}
