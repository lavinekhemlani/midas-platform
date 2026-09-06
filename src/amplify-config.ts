const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

if (!NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL is not set');
}

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '',
      region: process.env.NEXT_PUBLIC_COGNITO_REGION || '',
      loginWith: {
        oauth: {
          domain: 'midas-auth.auth.us-east-1.amazoncognito.com',
          scopes: ['email', 'profile', 'openid', 'aws.cognito.signin.user.admin'],
          redirectSignIn: [
            `${NEXT_PUBLIC_APP_URL}/sso-callback`
          ],
          redirectSignOut: [
            `${NEXT_PUBLIC_APP_URL}/`
          ],
          responseType: 'code' as const
        }
      }
    }
  }
};

export default amplifyConfig;