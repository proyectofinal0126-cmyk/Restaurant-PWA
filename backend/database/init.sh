#!/bin/bash

# Esperar a que PostgreSQL esté listo
echo "Esperando a PostgreSQL..."
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q'; do
  echo >&2 "PostgreSQL no está disponible aún - esperando..."
  sleep 1
done

echo "PostgreSQL está listo"

# Ejecutar schema
echo "Creando tablas..."
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /docker-entrypoint-initdb.d/schema.sql

# Ejecutar seeds
echo "Insertando datos iniciales..."
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /docker-entrypoint-initdb.d/seeds.sql

echo "Base de datos inicializada correctamente"