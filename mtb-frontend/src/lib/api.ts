console.log('API configuration loaded', process.env.NEXT_PUBLIC_APP_ENV);
const API_URL = process.env.NEXT_PUBLIC_APP_ENV === 'development' ? process.env.NEXT_PUBLIC_API_URL_DEV : process.env.NEXT_PUBLIC_API_URL_PROD;

export default API_URL;
