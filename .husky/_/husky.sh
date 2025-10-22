#!/usr/bin/env sh
# shellcheck shell=sh

if [ -z "$husky_skip_init" ]; then
  husky_skip_init=1
  if [ "${HUSKY:-1}" = "0" ]; then
    exit 0
  fi
fi
