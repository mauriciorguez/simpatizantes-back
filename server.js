// server.js
const express = require('express');
const cors = require('cors');
const pool = require('./models/db'); // asegúrate de que la ruta sea correcta
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Ya existe un usuario con ese correo' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);
    res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al registrar el usuario' });
  }
});

app.get('/api/getUsers', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener los usuarios' });
  }
});

app.get('/api/getIndicadores', async (req, res) => {
  try {
    const result = await pool.query(`SELECT 
    COUNT(*) AS total_registros,
    COUNT(DISTINCT num_distrito_local) AS total_distritos,
    COUNT(CASE WHEN estatus != 'Por llamar' THEN 1 END) AS total_contactados,
    COUNT(CASE WHEN estatus = 'Por llamar' THEN 1 END) AS pendientes_por_llamar,
    COUNT(CASE WHEN estatus = 'Verificado' THEN 1 END) AS pendientes_confirmados,
    COUNT(CASE WHEN estatus = 'Datos incorrectos' THEN 1 END) AS datos_incorrectos
FROM dgo_rc where cel != '0' and rol != 'representante de casila'`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener los usuarios' });
  }
});

app.get('/api/getDataGarf', async (req, res) => {
  try {
    const result = await pool.query(`SELECT 
  distrito,
  COUNT(CASE WHEN estatus = 'Por llamar' THEN 1 END) AS por_llamar,
  COUNT(CASE WHEN estatus = 'Verificado' THEN 1 END) AS Verificado,
  COUNT(CASE WHEN estatus = 'No contesta' THEN 1 END) AS No_contesta,
  COUNT(CASE WHEN estatus = 'No participa' THEN 1 END) AS No_participa,
  COUNT(CASE WHEN estatus = 'Datos incorrectos' THEN 1 END) AS Datos_incorrectos,
  COUNT(CASE WHEN estatus = 'Marcar despues' THEN 1 END) AS Marcar_después,
  COUNT(CASE WHEN estatus = 'Invitado' THEN 1 END) AS Invitado
FROM dgo_rc where cel != '0' and rol != 'representante de casila'
GROUP BY distrito;`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener los usuarios' });
  }
});

app.get('/api/getDataGarfPie', async (req, res) => {
  try {
    const result = await pool.query(`SELECT 'Por llamar' AS name, COUNT(*) AS value FROM dgo_rc WHERE estatus = 'Por llamar' AND cel != '0'
UNION ALL
SELECT 'Verificado', COUNT(*) FROM dgo_rc WHERE estatus = 'Verificado' AND cel != '0' and rol != 'representante de casila'
UNION ALL
SELECT 'No contesta', COUNT(*) FROM dgo_rc WHERE estatus = 'No contesta' AND cel != '0' and rol != 'representante de casila'
UNION ALL
SELECT 'Datos incorrectos', COUNT(*) FROM dgo_rc WHERE estatus = 'Datos incorrectos' AND cel != '0' and rol != 'representante de casila'
UNION ALL
SELECT 'Invitado', COUNT(*) FROM dgo_rc WHERE estatus = 'Invitado' AND cel != '0' and rol != 'representante de casila';`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener los usuarios' });
  }
});

app.post('/api/getUserByEmail', async (req, res) => {
  const { email } = req.body;  // Ahora obtienes el email desde el cuerpo de la solicitud (req.body)
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);  // Retorna el primer usuario encontrado
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener el usuario' });
  }
});

app.post('/api/call-por-usuario', async (req, res) => {
  const { usuario_responsable } = req.body;

  if (!usuario_responsable) {
    return res.status(400).json({ message: 'usuario_responsable es requerido' });
  }

  try {
    const query = `
  SELECT 
    id_2,  
    nombre_c, 
    cel, 
    estatus, 
    fecha, 
    hora, 
    distrito,
    usuario_responsable 
  FROM dgo_rc 
  WHERE usuario_responsable = $1 AND estatus = $2 AND cel != '0' and rol != 'representante de casila'
  ORDER BY distrito ASC;
`;

    const result = await pool.query(query, [usuario_responsable, 'Por llamar']);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No se encontraron registros para este usuario' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.post('/api/call-por-distrito', async (req, res) => {
  const { usuario_responsable, distrito } = req.body;

  if (!usuario_responsable) {
    return res.status(400).json({ message: 'usuario_responsable es requerido' });
  }

  try {
    const query = `
  SELECT 
    id_2,  
    nombre_c, 
    cel, 
    estatus, 
    fecha, 
    hora, 
    distrito, 
    usuario_responsable 
  FROM dgo_rc 
  WHERE usuario_responsable = $1 AND estatus = $2 AND distrito = $3 AND cel != '0' and rol != 'representante de casila'
  ORDER BY distrito ASC;
`;

    const result = await pool.query(query, [usuario_responsable, 'Por llamar', distrito]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No se encontraron registros para este usuario' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Ruta genérica para diferentes estatus
app.post('/api/call-pendientes', async (req, res) => {
  const { usuario_responsable, estatus } = req.body;

  if (!usuario_responsable || !estatus) {
    return res.status(400).json({ message: 'usuario_responsable y estatus son requeridos' });
  }

  try {
    const query = `
      SELECT 
    v.id_2,  
    v.nombre_c, 
    v.cel, 
    v.estatus, 
    v.fecha, 
    v.hora, 
    v.distrito,
    v.usuario_responsable,
    COUNT(h.cel) AS total_contactos,
    SUM(CASE WHEN h.tipo_contacto = 'Llamada' THEN 1 ELSE 0 END) AS total_llamadas,
    SUM(CASE WHEN h.tipo_contacto = 'WhatsApp' THEN 1 ELSE 0 END) AS total_whatsapp
FROM dgo_rc v
LEFT JOIN call_dgo_h h ON v.cel = h.cel 
WHERE v.usuario_responsable = $1 and v.estatus = $2 AND v.cel != '0' and v.rol != 'representante de casila'
GROUP BY 
    v.id_2,  
    v.nombre_c, 
    v.cel, 
    v.estatus, 
    v.fecha, 
    v.hora, 
    v.distrito,
    v.usuario_responsable
ORDER BY v.distrito ASC;
    `;
    const result = await pool.query(query, [usuario_responsable, estatus]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});


app.post('/api/updateCallDgo', async (req, res) => {
  const { estatus, id_2, observaciones, tipo_contacto } = req.body;
  try {

    await pool.query(
      `UPDATE dgo_rc 
   SET estatus = $1, 
       fecha = CURRENT_DATE, 
       hora = (CURRENT_TIME AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City'),
       observaciones = $3,
       tipo_contacto = $4
   WHERE id_2 = $2`,
      [estatus, id_2, observaciones, tipo_contacto]
    );

    res.status(200).json({ message: 'Estatus actualizado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar el estatus' });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
