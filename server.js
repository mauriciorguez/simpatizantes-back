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
  FROM call_dgo_v 
  WHERE usuario_responsable = $1 AND estatus = $2
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
  FROM call_dgo_v 
  WHERE usuario_responsable = $1 AND estatus = $2 AND distrito = $3
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
        id_2,  
        nombre_c, 
        cel, 
        estatus, 
        fecha, 
        hora, 
        usuario_responsable,
        distrito
      FROM call_dgo_v 
      WHERE usuario_responsable = $1 AND estatus = $2
      order by distrito asc
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
      `UPDATE call_dgo_v 
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
