# Firebase Setup Instructions

## 🔧 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: `google-genai-workshop`
4. Follow the setup wizard
5. Enable Google Analytics (optional)

## 🔧 Step 2: Configure Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Google** provider:
   - Click on Google
   - Toggle "Enable"
   - Add your project support email
   - Save
3. Enable **Email/Password** provider:
   - Click on Email/Password
   - Toggle "Enable" for "Email link (passwordless sign-in)"
   - Save

## 🔧 Step 3: Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" → Web app (</> icon)
4. Register your app with nickname: `Google GenAI Workshop`
5. Copy the Firebase configuration object

## 🔧 Step 4: Update Environment Variables

Update the `.env.local` file in the `client` directory with your Firebase configuration:

```env
REACT_APP_FIREBASE_API_KEY=your_actual_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_actual_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
REACT_APP_FIREBASE_APP_ID=your_actual_app_id
```

## 🔧 Step 5: Configure Domain/Email Whitelisting

Update the allowed domains and emails in `client/src/contexts/auth-context.js`:

```javascript
// Configure allowed domains and emails
const allowedDomains = ["yourdomain.com", "anotherdomain.com"]
const allowedEmails = [
  "admin@yourdomain.com",
  "user@anotherdomain.com"
]
```

## 🔧 Step 6: Test the Implementation

1. Start the development server:
   ```bash
   cd client
   npm start
   ```

2. Test Google Sign-in:
   - Click "Sign in with Google"
   - Complete the Google OAuth flow
   - Verify user is signed in

3. Test Email Sign-in:
   - Click "Sign in with Email"
   - Enter an allowed email address
   - Check your email for the sign-in link
   - Click the link to complete sign-in

## 🔧 Step 7: Production Deployment

### Environment Variables
- Ensure all Firebase environment variables are set in your deployment platform
- Use different Firebase projects for development/staging/production

### Domain Configuration
- Add your production domain to Firebase Console → Authentication → Settings → Authorized domains
- Update the `actionCodeSettings.url` in the email sign-in function

## 🎯 Features Implemented

✅ **Google Sign-in** - One-click authentication with Google  
✅ **Email Link Authentication** - Passwordless email sign-in  
✅ **Domain/Email Whitelisting** - Restrict access to specific domains and emails  
✅ **Automatic Redirects** - Seamless user experience  
✅ **Error Handling** - Comprehensive error messages and validation  
✅ **Loading States** - User feedback during authentication  
✅ **Cookie-based Server Auth** - Server-side authentication checks  

## 🚀 Next Steps

1. Customize the UI components to match your brand
2. Implement role-based access control if needed
3. Add user profile management
4. Set up email templates in Firebase Console
5. Configure production domains and security rules
