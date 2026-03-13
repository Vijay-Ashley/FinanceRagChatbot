# 🚀 VM Deployment Guide - Invoice RAG v3 (March 2026 Updates)

## 📝 **What Changed**

### Backend Changes (app.py)
- ✅ **Fixed duplicate sources issue** - Now shows only unique documents in sources
- ✅ **Improved source deduplication** - Tracks best score per document
- ✅ **Better context building** - Removes duplicate chunks

### Frontend Changes (ui/src/App.tsx)
- ✅ **Already has deduplication** - Frontend was already deduplicating sources
- ✅ **No changes needed** - UI is working correctly

---

## 🔄 **Deployment Steps**

### **Step 1: Build the UI Locally (Windows)**

```powershell
# Navigate to project directory
cd "c:\Users\VVerma\OneDrive - Ashley Furniture Industries, Inc\Documents\AI coding\Ragincloud\ragf1\Ragforfinance\rag_pdf_finance\finalinvoicerag_v3"

# Run the build script
.\build_ui.ps1
```

**What this does:**
- Builds the React UI from `ui/src/`
- Creates optimized production files in `ui/dist/`
- Copies the build to `public/` folder
- The `public/` folder is what gets deployed to the VM

---

### **Step 2: Prepare Files for VM**

Create a deployment package with these files:

```
finalinvoicerag_v3/
├── app.py                          ← Updated with source fix
├── cosmos_hybrid_retriever.py
├── cosmos_store.py
├── metadata_extractor.py
├── query_classifier.py
├── requirements.txt
├── public/                         ← Built UI (from Step 1)
│   ├── index.html
│   └── assets/
│       ├── index-*.js
│       └── index-*.css
└── uploads/                        ← Create empty folder
```

**Files to EXCLUDE:**
- ❌ `ui/` folder (source code, not needed on VM)
- ❌ `node_modules/`
- ❌ `__pycache__/`
- ❌ `.venv/`
- ❌ `app_backup_before_duplicate_fix.py`

---

### **Step 3: Transfer Files to VM**

#### **Option A: Using SCP (from Windows PowerShell)**

```powershell
# Create a zip file first
Compress-Archive -Path "app.py", "cosmos_*.py", "metadata_extractor.py", "query_classifier.py", "requirements.txt", "public" -DestinationPath "deployment.zip" -Force

# Transfer to VM
scp deployment.zip your-username@your-vm-ip:/home/your-username/
```

#### **Option B: Using Git (Recommended)**

```powershell
# Initialize git (if not already done)
cd finalinvoicerag_v3
git init
git add app.py cosmos_*.py metadata_extractor.py query_classifier.py requirements.txt public/
git commit -m "Deploy: Fixed duplicate sources issue"

# Push to your repository
git remote add origin https://github.com/YourUsername/invoice-rag-v3.git
git push -u origin main
```

Then on VM:
```bash
cd /home/your-username
git clone https://github.com/YourUsername/invoice-rag-v3.git
cd invoice-rag-v3
```

---

### **Step 4: Deploy on VM**

#### **4.1 Connect to VM**
```bash
ssh your-username@your-vm-ip
```

#### **4.2 Navigate to Project**
```bash
cd /home/your-username/invoice-rag-v3
# OR if you used SCP:
cd /home/your-username
unzip deployment.zip -d invoice-rag-v3
cd invoice-rag-v3
```

#### **4.3 Set Up Python Environment**
```bash
# Create virtual environment
python3 -m venv .venv

# Activate
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

#### **4.4 Create .env File**
```bash
nano .env
```

Add your environment variables:
```env
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=your_endpoint_here
AZURE_OPENAI_DEPLOYMENT=gpt-4
AZURE_OPENAI_EMBED_DEPLOYMENT=text-embedding-3-small
COSMOS_ENDPOINT=your_cosmos_endpoint
COSMOS_KEY=your_cosmos_key
COSMOS_DATABASE_NAME=rag_finance_db
COSMOS_CONTAINER_NAME=documents
```

Save: `Ctrl+X`, then `Y`, then `Enter`

---

### **Step 5: Run the Application**

#### **Option A: Test Run (Foreground)**
```bash
python -m uvicorn app:app --host 0.0.0.0 --port 9000
```

#### **Option B: Production Run (Background with systemd)**

Create service file:
```bash
sudo nano /etc/systemd/system/invoice-rag.service
```

Add this content:
```ini
[Unit]
Description=Invoice RAG v3 Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/invoice-rag-v3
Environment="PATH=/home/your-username/invoice-rag-v3/.venv/bin"
ExecStart=/home/your-username/invoice-rag-v3/.venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 9000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable invoice-rag
sudo systemctl start invoice-rag
sudo systemctl status invoice-rag
```

---

### **Step 6: Configure Firewall**

```bash
# Allow port 9000
sudo ufw allow 9000/tcp

# Check status
sudo ufw status
```

---

### **Step 7: Test the Deployment**

```bash
# From VM
curl http://localhost:9000/health

# From your local machine
curl http://your-vm-ip:9000/health
```

**Expected response:**
```json
{"status":"ok"}
```

---

## 🧪 **Verify the Fix**

1. Open browser: `http://your-vm-ip:9000`
2. Ask a question: "What is the total amount for Colabs Holdings?"
3. Check sources - should show **only 1-2 relevant invoices**, not all 13!

---

## 📊 **Monitoring & Logs**

```bash
# View logs (if using systemd)
sudo journalctl -u invoice-rag -f

# View logs (if using nohup)
tail -f app.log
```

---

## 🔄 **Future Updates**

To deploy future changes:

```bash
# On VM
cd /home/your-username/invoice-rag-v3
git pull origin main
sudo systemctl restart invoice-rag
```

---

## ❓ **Troubleshooting**

### Issue: Server won't start
```bash
# Check logs
sudo journalctl -u invoice-rag -n 50

# Check if port is in use
sudo lsof -i :9000

# Kill existing process
sudo kill -9 $(sudo lsof -t -i:9000)
```

### Issue: Still showing all invoices
- Make sure you deployed the **updated app.py**
- Verify the server restarted: `sudo systemctl restart invoice-rag`
- Clear browser cache: `Ctrl+Shift+R`

---

## ✅ **Deployment Checklist**

- [ ] Build UI locally with `.\build_ui.ps1`
- [ ] Verify `public/` folder has index.html and assets/
- [ ] Transfer files to VM (via SCP or Git)
- [ ] Install Python dependencies on VM
- [ ] Create .env file with credentials
- [ ] Test run the application
- [ ] Configure systemd service
- [ ] Configure firewall
- [ ] Test from browser
- [ ] Verify sources show only relevant documents

---

**🎉 Done! Your VM is now running the updated Invoice RAG v3 with the duplicate sources fix!**

