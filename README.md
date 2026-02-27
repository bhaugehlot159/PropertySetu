# PropertySetu

## Project setup

### Backend (Node.js + Express)
1. Go to backend folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file in `server/` with:
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/propertysetu
   JWT_SECRET=your_jwt_secret
   RAZORPAY_KEY_ID=your_razorpay_key
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   ```
4. Start server:
   ```bash
   npm run dev
   ```

Health check:
- `GET http://localhost:5000/` → `{"message":"PropertySetu API Running"}`

### Frontend (Static HTML/CSS/JS)
Serve project root with any static server, for example:
```bash
npx serve .
```
Then open the shown URL in browser.


## Codex PR workflow note
If Codex shows this message:
- `Codex does not currently support updating PRs that are updated outside of Codex.`

Use this flow:
1. Commit new changes on the same branch.
2. Create a **new PR** from Codex instead of trying to update the old PR.
3. Close/supersede the previous PR in GitHub if needed.
