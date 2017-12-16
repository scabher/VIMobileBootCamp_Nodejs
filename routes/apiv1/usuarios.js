'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator/check');

const customError = require('../../lib/custom_error');
const Usuario = require('../../models/Usuario');

/**
 * Creación de un nuevo usuario
 */
router.post('/', [
  body('nombre').isAlpha().not().isEmpty().withMessage('USER_WRONG_EMAIL'),
  body('email').isEmail().withMessage('FIELDS_ARE_MANDATORY'),
  body('clave').not().isEmpty('USER_WRONG_EMAIL')
], async (req, res, next) => {
  const lang = req.query.lang || 'en';

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // return res.status(422).json({ errors: errors.mapped() });
    const errorsArray = errors.array();
    console.log(errorsArray);
    for (let i = 0; i < errorsArray.length; i++) {
      const element = errorsArray[i];
      element.msg = customError.getCustomError(element.msg, lang);
    }
    console.log(errorsArray);
    res.status(422);
    next(customError.getCustomError('FIELDS_ARE_MANDATORY', lang));
    return;
  }
    
  const usuarioExistente = await Usuario.findOne({ email: req.body.email }).exec();
  if (usuarioExistente) {
    next(customError.getCustomError('EMAIL_ALREADY_EXISTS', lang));
    return;
  }

  const usuario = new Usuario(req.body);
  const hash = crypto.createHash('sha256');
  usuario.clave = hash.update(usuario.clave).digest('base64');
  usuario.save((err, usuarioGuardado) => {
    if (err) {
      next(customError.getCustomError('USER_CANNOT_SAVE', lang) + err);
      return;
    }

    res.json({
      sucess: true,
      result: usuarioGuardado
    });
  });
});

router.post('/authenticate', async (req, res, next) => {
  try {
    // recogemos las redenciales
    const email = req.body.email;
    const password = req.body.password;
    const lang = req.query.lang || 'en';

    // buscamos en la BBDD el usuario
    const usuario = await Usuario.findOne({ email: req.body.email }).exec();
    if (!usuario) {
      next(customError.getCustomError('USER_NOT_FOUND', lang));
      return;
    }
    
    const hash = crypto.createHash('sha256');
    if (usuario.clave != hash.update(password).digest('base64')) {
      next(customError.getCustomError('AUTH_WRONG_CREDENTIALS', lang));
      return;
    }

    // si el usuario existe y el password coindice, creamos y devolvemos un token 
    jwt.sign({ user_id: usuario._id}, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    }, (err, token) => {
      if (err) {
        return next(err); 
      }

      res.json({ sucess: true, token: token});
    });
    
  } catch (error) {
    next(customError.getCustomError('AUTH_GENERIC_ERROR', lang) + error);    
  }
});

module.exports = router;