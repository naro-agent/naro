import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export const getPersonas = () => client.get('/personas').then(r => r.data);
export const getPersona = (id) => client.get(`/personas/${id}`).then(r => r.data);

export const runDiagnosis = (profile) =>
  client.post('/diagnosis', { profile }).then(r => r.data);

export const runSimulation = (profile) =>
  client.post('/simulation', { profile }).then(r => r.data);

export const runRecommend = (profile, diagnosis) =>
  client.post('/recommend', { profile, diagnosis }).then(r => r.data);

export const sendChat = (message, profile, diagnosis, history, mode = 'free') =>
  client.post('/chat', { message, profile, diagnosis, history, mode }).then(r => r.data);

export const submitFeedback = (data) =>
  client.post('/feedback', data).then(r => r.data);
