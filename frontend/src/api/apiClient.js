import axios from 'axios';

// 로컬: Vite 프록시(/api → localhost:8000)
// 프로덕션: VITE_API_URL=https://naro-api.railway.app 으로 직접 요청
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const client = axios.create({
  baseURL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

export const getPersonas = () => client.get('/personas').then(r => r.data);
export const getPersona = (id) => client.get(`/personas/${id}`).then(r => r.data);

export const runDiagnosis = (profile) =>
  client.post('/diagnosis', { profile }).then(r => r.data);

export const runSimulation = (profile) =>
  client.post('/simulation', { profile }).then(r => r.data);

export const runRecommend = (profile, diagnosis, survey_scores) =>
  client.post('/recommend', { profile, diagnosis, survey_scores }).then(r => r.data);

export const sendChat = (message, profile, diagnosis, simulation, survey_scores, history, mode = 'free') =>
  client.post('/chat', { message, profile, diagnosis, simulation, survey_scores, history, mode }).then(r => r.data);

export const submitFeedback = (data) =>
  client.post('/feedback', data).then(r => r.data);
