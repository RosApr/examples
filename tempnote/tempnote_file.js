import { Hoa } from 'hoa'
import { tinyRouter } from '@hoajs/tiny-router'
import { cookie } from '@hoajs/cookie'

const app = new Hoa()
app.extend(cookie())
app.extend(tinyRouter())

const fileInfoManagment = {
    async getList(ctx) {
        const key = getKey(ctx)
        const list = await ctx.env.KV.get(key) || []
        return JSON.parse(list)
    },
    async delete(ctx, fileInfo) {
        const key = getKey(ctx)
        const list = await fileInfoManagment.getList(ctx)
        const index = list.findIndex(f => f.name === fileInfo.name)
        if (index >= 0) {
            list.splice(index, 1)
            await ctx.env.KV.put(key, JSON.stringify(newList), {
                expirationTtl: 86400 * 365,
            })
        }
        return index >= 0
    },
    async update(ctx, file) {
        const fileInfo = fileInfoManagment.getInfo(file)
        const list = await fileInfoManagment.getList(ctx)
        const newList = [...list, fileInfo]
        await ctx.env.KV.put(getKey(ctx), JSON.stringify(newList), {
            expirationTtl: 86400 * 365,
        })
        return newList``
    },
    async getInfo(file) {
        return { name: file.name, size: fileInfoManagment.getSize(file) }
    },
    getSize(file) {
        const size = file.size
        if (size === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(size) / Math.log(k))
        return Math.round(size / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
    }
}

const fileManagment = {
    async upload(ctx, file) {
        await ctx.env.MY_BUCKET.put(file.name, file)
    },
    async find(ctx, file) {
        return await ctx.env.MY_BUCKET.get(file.name)
    },
    async delete(ctx, fileInfo) {
        await ctx.env.MY_BUCKET.delete(fileInfo.name)
    }
}

function getKey(ctx) {
    return `file:${ctx.req.params.path}`
}

app.post('/:path/upload', async (ctx, next) => {
    const formData = ctx.req.body
    const file = formData.get('file')

    await fileInfoManagment.update(ctx, fileInfoManagment.getInfo(file))
    await fileManagment.upload(ctx, file)
    ctx.res.body = true
})

app.delete('/:path', async (ctx, next) => {
    const { file } = ctx.req.body
    const isDeleted = await fileInfoManagment.delete(ctx, { name: file })
    isDeleted && await fileManagment.delete(ctx, { name: file })
    ctx.res.body = true
})

app.get('/:path', async (ctx, next) => {
    const { path } = ctx.req.params
    if (path === 'favicon.ico') {
        ctx.res.status = 204
        return
    }
    ctx.res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
    })
    await ctx.res.setCookie('last_path', path)

    ctx.res.body = `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>File Manager</title>
    <style>
        * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        }

        html, body {
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        }

        .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px;
        }

        .header {
        text-align: center;
        color: white;
        margin-bottom: 40px;
        }

        .header h1 {
        font-size: 48px;
        font-weight: 700;
        margin-bottom: 10px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header p {
        font-size: 18px;
        opacity: 0.9;
        }

        .upload-section {
        background: white;
        border-radius: 16px;
        padding: 40px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        margin-bottom: 30px;
        }

        .upload-area {
        border: 3px dashed #667eea;
        border-radius: 12px;
        padding: 60px 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s ease;
        background: #f8f9ff;
        }

        .upload-area:hover {
        border-color: #764ba2;
        background: #f0f2ff;
        transform: translateY(-2px);
        }

        .upload-area.dragover {
        border-color: #764ba2;
        background: #e8ebff;
        transform: scale(1.02);
        }

        .upload-icon {
        font-size: 64px;
        margin-bottom: 20px;
        color: #667eea;
        }

        .upload-text {
        font-size: 20px;
        color: #333;
        margin-bottom: 10px;
        font-weight: 600;
        }

        .upload-hint {
        font-size: 14px;
        color: #666;
        }

        #fileInput {
        display: none;
        }

        .file-list {
        background: white;
        border-radius: 16px;
        padding: 30px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        min-height: 200px;
        }

        .file-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #f0f0f0;
        }

        .file-list-title {
        font-size: 24px;
        font-weight: 700;
        color: #333;
        }

        .refresh-btn {
        padding: 10px 20px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s ease;
        }

        .refresh-btn:hover {
        background: #764ba2;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .file-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        margin-bottom: 12px;
        background: #f8f9ff;
        border-radius: 12px;
        transition: all 0.3s ease;
        border: 1px solid transparent;
        }

        .file-item:hover {
        background: #f0f2ff;
        border-color: #667eea;
        transform: translateX(5px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .file-info {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        }

        .file-icon {
        font-size: 32px;
        margin-right: 15px;
        flex-shrink: 0;
        }

        .file-details {
        flex: 1;
        min-width: 0;
        }

        .file-name {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 5px;
        word-break: break-all;
        }

        .file-meta {
        font-size: 13px;
        color: #666;
        }

        .file-actions {
        display: flex;
        gap: 10px;
        flex-shrink: 0;
        }

        .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s ease;
        }

        .btn-download {
        background: #667eea;
        color: white;
        }

        .btn-download:hover {
        background: #5568d3;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-delete {
        background: #ef4444;
        color: white;
        }

        .btn-delete:hover {
        background: #dc2626;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }

        .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #999;
        }

        .empty-icon {
        font-size: 64px;
        margin-bottom: 20px;
        opacity: 0.5;
        }

        .empty-text {
        font-size: 18px;
        }

        .progress-bar {
        width: 100%;
        height: 6px;
        background: #e0e0e0;
        border-radius: 3px;
        overflow: hidden;
        margin-top: 20px;
        display: none;
        }

        .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        width: 0%;
        transition: width 0.3s ease;
        }

        .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: none;
        align-items: center;
        gap: 12px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
        }

        .toast.success {
        border-left: 4px solid #10b981;
        }

        .toast.error {
        border-left: 4px solid #ef4444;
        }

        .toast-icon {
        font-size: 24px;
        }

        .toast-message {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        }

        @media (max-width: 768px) {
        .header h1 {
            font-size: 36px;
        }

        .upload-section {
            padding: 20px;
        }

        .file-list {
            padding: 20px;
        }

        .file-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
        }

        .file-actions {
            width: 100%;
            justify-content: flex-end;
        }
        }
    </style>
    </head>
    <body>
    <div class="container">
        <div class="header">
        <h1>📁 File Manager</h1>
        <p>Upload, manage and share your files securely</p>
        </div>

        <div class="upload-section">
        <div class="upload-area" id="uploadArea">
            <div class="upload-icon">☁️</div>
            <div class="upload-text">Click to upload or drag and drop</div>
            <div class="upload-hint">Support any file type, max 100MB</div>
        </div>
        <input type="file" id="fileInput" multiple />
        <div class="progress-bar" id="progressBar">
            <div class="progress-fill" id="progressFill"></div>
        </div>
        </div>

        <div class="file-list">
        <div class="file-list-header">
            <div class="file-list-title">My Files</div>
            <button class="refresh-btn" id="refreshBtn">🔄 Refresh</button>
        </div>
        <div id="fileListContainer">
            <div class="empty-state">
            <div class="empty-icon">📂</div>
            <div class="empty-text">No files yet. Upload your first file!</div>
            </div>
        </div>
        </div>
    </div>

    <div class="toast" id="toast">
        <div class="toast-icon" id="toastIcon"></div>
        <div class="toast-message" id="toastMessage"></div>
    </div>

    <script>
        const uploadArea = document.getElementById('uploadArea')
        const fileInput = document.getElementById('fileInput')
        const fileListContainer = document.getElementById('fileListContainer')
        const refreshBtn = document.getElementById('refreshBtn')
        const progressBar = document.getElementById('progressBar')
        const progressFill = document.getElementById('progressFill')
        const toast = document.getElementById('toast')
        const toastIcon = document.getElementById('toastIcon')
        const toastMessage = document.getElementById('toastMessage')

        // 上传区域点击
        uploadArea.addEventListener('click', () => {
        fileInput.click()
        })

        // 文件选择
        fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files)
        })

        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault()
        uploadArea.classList.add('dragover')
        })

        uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover')
        })

        uploadArea.addEventListener('drop', (e) => {
        e.preventDefault()
        uploadArea.classList.remove('dragover')
        handleFiles(e.dataTransfer.files)
        })

        // 处理文件上传
        async function handleFiles(files) {
        if (files.length === 0) return

        progressBar.style.display = 'block'
        progressFill.style.width = '0%'

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const formData = new FormData()
            formData.append('file', file)

            try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            const result = await response.json()
            
            if (response.ok) {
                showToast('success', \`✅ \${file.name} uploaded successfully!\`)
            } else {
                showToast('error', \`❌ Failed to upload \${file.name}\`)
            }

            progressFill.style.width = \`\${((i + 1) / files.length) * 100}%\`
            } catch (error) {
            showToast('error', \`❌ Error uploading \${file.name}\`)
            }
        }

        setTimeout(() => {
            progressBar.style.display = 'none'
            fileInput.value = ''
            loadFiles()
        }, 500)
        }

        // 加载文件列表
        async function loadFiles() {
        try {
            const response = await fetch('/api/files')
            const result = await response.json()

            if (result.files && result.files.length > 0) {
            renderFiles(result.files)
            } else {
            fileListContainer.innerHTML = \`
                <div class="empty-state">
                <div class="empty-icon">📂</div>
                <div class="empty-text">No files yet. Upload your first file!</div>
                </div>
            \`
            }
        } catch (error) {
            showToast('error', '❌ Failed to load files')
        }
        }

        // 渲染文件列表
        function renderFiles(files) {
        fileListContainer.innerHTML = files.map(file => \`
            <div class="file-item">
            <div class="file-info">
                <div class="file-icon">\${getFileIcon(file.name)}</div>
                <div class="file-details">
                <div class="file-name">\${file.name}</div>
                <div class="file-meta">\${formatFileSize(file.size)} • \${formatDate(file.uploaded)}</div>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-download" onclick="downloadFile('\${file.key}', '\${file.name}')">
                ⬇️ Download
                </button>
                <button class="btn btn-delete" onclick="deleteFile('\${file.key}', '\${file.name}')">
                🗑️ Delete
                </button>
            </div>
            </div>
        \`).join('')
        }

        // 下载文件
        async function downloadFile(key, name) {
        try {
            const response = await fetch(\`/api/download/\${key}\`)
            if (response.ok) {
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = name
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            showToast('success', \`✅ \${name} downloaded!\`)
            } else {
            showToast('error', '❌ Failed to download file')
            }
        } catch (error) {
            showToast('error', '❌ Error downloading file')
        }
        }

        // 删除文件
        async function deleteFile(key, name) {
        if (!confirm(\`Are you sure you want to delete "\${name}"?\`)) {
            return
        }

        try {
            const response = await fetch(\`/api/delete/\${key}\`, {
            method: 'DELETE'
            })

            if (response.ok) {
            showToast('success', \`✅ \${name} deleted!\`)
            loadFiles()
            } else {
            showToast('error', '❌ Failed to delete file')
            }
        } catch (error) {
            showToast('error', '❌ Error deleting file')
        }
        }

        // 显示提示
        function showToast(type, message) {
        toast.className = \`toast \${type}\`
        toastIcon.textContent = type === 'success' ? '✅' : '❌'
        toastMessage.textContent = message
        toast.style.display = 'flex'

        setTimeout(() => {
            toast.style.display = 'none'
        }, 3000)
        }

        // 获取文件图标
        function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase()
        const iconMap = {
            'pdf': '📄',
            'doc': '📝', 'docx': '📝',
            'xls': '📊', 'xlsx': '📊',
            'ppt': '📊', 'pptx': '📊',
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️',
            'mp4': '🎬', 'avi': '🎬', 'mov': '🎬',
            'mp3': '🎵', 'wav': '🎵',
            'zip': '📦', 'rar': '📦', '7z': '📦',
            'txt': '📃',
            'js': '📜', 'json': '📜', 'html': '📜', 'css': '📜',
        }
        return iconMap[ext] || '📄'
        }

        // 格式化文件大小
        function formatFileSize(bytes) {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
        }

        // 格式化日期
        function formatDate(dateString) {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now - date
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        
        if (days === 0) return 'Today'
        if (days === 1) return 'Yesterday'
        if (days < 7) return \`\${days} days ago\`
        return date.toLocaleDateString()
        }

        // 刷新按钮
        refreshBtn.addEventListener('click', loadFiles)

        // 页面加载时获取文件列表
        loadFiles()
    </script>
    </body>
    </html>
  `
})

app.use(async (ctx, next) => {
    const lastPath = await ctx.req.getCookie('last_path')
    ctx.res.redirect(lastPath || randomPath())
})

export default app

function randomPath(len = 6) {
    const chars =
        '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let result = ''
    for (let i = 0; i < len; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}
