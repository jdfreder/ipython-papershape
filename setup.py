# -*- coding: utf-8 -*-
from __future__ import print_function
from setuptools import setup
try:
    from jupyterpip import cmdclass
except:
    import pip, importlib
    pip.main(['install', 'jupyter-pip']); cmdclass = importlib.import_module('jupyterpip').cmdclass

setup(
    name='paper',
    version='0.1',
    description='Paper.js widget for IPython',
    author='Jonathan Frederic',
    author_email='jdfreder',
    license='New BSD',
    url='https://github.com/jdfreder/paper',
    keywords='python ipython javascript widget paper',
    classifiers=['Development Status :: 4 - Beta',
                 'Programming Language :: Python',
                 'License :: OSI Approved :: MIT License'],
    packages=['paper'],
    include_package_data=True,
    install_requires=["jupyter-pip"],
    cmdclass=cmdclass('paper'),
)
