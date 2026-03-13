# ⚡ Quick Deployment Reference

## 🚀 **One-Command Deployment**

### **On Windows (Local Machine)**

```powershell
# 1. Build and package everything
.\prepare_deployment.ps1

# 2. Transfer to VM (replace with your VM details)
scp invoice-rag-v3-deployment.zip your-username@your-vm-ip:/home/your-username/
```

---

### **On VM (Linux)**

```bash
# 1. Extract
unzip invoice-rag-v3-deployment.zip -d invoice-rag-v3
cd invoice-rag-v3

# 2. Setup Python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Create .env file
nano .env
# Add your credentials (see VM_DEPLOYMENT_STEPS.md)

# 4. Run
python -m uvicorn app:app --host 0.0.0.0 --port 9000
```

---

## 📋 **What Changed in This Update**

| File | Change | Impact |
|------|--------|--------|
| `app.py` | Fixed duplicate sources | Shows only unique documents in sources |
| `ui/src/App.tsx` | No change needed | Already had deduplication |

---

## ✅ **Verification**

After deployment, test:

```bash
# Health check
curl http://your-vm-ip:9000/health

# Test query (from browser)
http://your-vm-ip:9000
```

**Expected Result:**
- Sources should show **only 2-3 relevant invoices**, not all 13!

---

## 🔄 **Quick Update (Future Changes)**

```bash
# On VM
cd invoice-rag-v3
git pull
sudo systemctl restart invoice-rag
```

---

## 📞 **Need Help?**

See full guide: `VM_DEPLOYMENT_STEPS.md`

